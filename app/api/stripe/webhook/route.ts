import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { clerkClient } from "@clerk/nextjs/server";
import { confirmationEmailHtml, sendEmail } from "@/lib/email";

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function looksLikeDuplicateOrAlreadyJoined(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("duplicate") ||
    m.includes("already") ||
    m.includes("unique") ||
    m.includes("violates unique constraint")
  );
}

function looksLikeCapacityOrJoinWindowFailure(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("full") ||
    m.includes("capacity") ||
    m.includes("sold out") ||
    m.includes("closed") ||
    m.includes("join window") ||
    m.includes("too late") ||
    m.includes("not open")
  );
}

function minusHours(iso: string, hours: number) {
  const ms = new Date(iso).getTime() - hours * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

async function getClerkEmail(userId: string) {
  try {
    const user = await clerkClient.users.getUser(userId);
    return (
      user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses?.[0]?.emailAddress ??
      null
    );
  } catch {
    return null;
  }
}

async function enrichBookingAndSendConfirmation(args: {
  clerkUserId: string;
  writingSessionId: string;
}) {
  const email = await getClerkEmail(args.clerkUserId);

  const { data: sessionRow, error: sErr } = await supabaseAdmin
    .from("sessions")
    .select("id,title,starts_at")
    .eq("id", args.writingSessionId)
    .maybeSingle();

  if (sErr || !sessionRow) return { enriched: false };

  const { data: bookingRow, error: bErr } = await supabaseAdmin
    .from("bookings")
    .select("id,confirmation_sent")
    .eq("session_id", args.writingSessionId)
    .eq("user_id", args.clerkUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bErr || !bookingRow) return { enriched: false };

  // update reminder fields + email (best-effort)
  await supabaseAdmin
    .from("bookings")
    .update({
      user_email: email,
      reminder_24h_at: minusHours(sessionRow.starts_at, 24),
      reminder_1h_at: minusHours(sessionRow.starts_at, 1),
    })
    .eq("id", bookingRow.id);

  // send confirmation once
  if (email && !bookingRow.confirmation_sent) {
    try {
      await sendEmail({
        to: email,
        subject: `Confirmed: ${sessionRow.title}`,
        html: confirmationEmailHtml({
          sessionTitle: sessionRow.title,
          startsAtIso: sessionRow.starts_at,
        }),
      });

      await supabaseAdmin
        .from("bookings")
        .update({ confirmation_sent: true })
        .eq("id", bookingRow.id);
    } catch {
      // leave false so it can be retried later if needed
    }
  }

  return { enriched: true };
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET env var" },
      { status: 500 }
    );
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${getErrorMessage(err)}` },
      { status: 400 }
    );
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.payment_status !== "paid") {
    return NextResponse.json({
      received: true,
      ignored: "payment_status_not_paid",
    });
  }

  const clerkUserId = session.metadata?.clerk_user_id;
  const writingSessionId = session.metadata?.writing_session_id;

  if (!clerkUserId || !writingSessionId) {
    return NextResponse.json({
      received: true,
      ignored: "missing_metadata",
    });
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  const { error } = await supabaseAdmin.rpc("join_session", {
    p_session_id: writingSessionId,
    p_user_id: clerkUserId,
  });

  if (!error) {
    await enrichBookingAndSendConfirmation({ clerkUserId, writingSessionId });
    return NextResponse.json({ received: true, fulfilled: true });
  }

  const msg = String(error.message ?? "");

  if (looksLikeDuplicateOrAlreadyJoined(msg)) {
    // treat as success; still attempt to enrich + send confirmation once
    await enrichBookingAndSendConfirmation({ clerkUserId, writingSessionId });
    return NextResponse.json({ received: true, deduped: true });
  }

  if (looksLikeCapacityOrJoinWindowFailure(msg)) {
    if (!paymentIntentId) {
      return NextResponse.json({
        received: true,
        refunded: false,
        reason: "no_payment_intent",
        join_error: msg,
      });
    }

    try {
      await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          reason: "requested_by_customer",
          metadata: {
            clerk_user_id: clerkUserId,
            writing_session_id: writingSessionId,
            failure_reason: msg.slice(0, 450),
            stripe_event_id: event.id,
          },
        },
        { idempotencyKey: `refund_${event.id}` }
      );

      return NextResponse.json({
        received: true,
        refunded: true,
        join_error: msg,
      });
    } catch (refundErr: unknown) {
      return NextResponse.json(
        { error: `Refund failed: ${getErrorMessage(refundErr)}`, join_error: msg },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: msg }, { status: 500 });
}