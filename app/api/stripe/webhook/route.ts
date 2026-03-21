import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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

// Webhooks retry; these should be treated as success.
function looksLikeDuplicateOrAlreadyJoined(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("duplicate") ||
    m.includes("already") ||
    m.includes("unique") ||
    m.includes("violates unique constraint")
  );
}

// These errors mean "can't fulfill booking" -> auto-refund.
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
  } catch (err: unknown) {
    console.error("Failed to fetch Clerk email in Stripe webhook", {
      userId,
      error: getErrorMessage(err),
    });
    return null;
  }
}

function getStripeCheckoutEmail(
  session: Stripe.Checkout.Session
): string | null {
  const cd = session.customer_details as { email?: string | null } | null;
  const emailFromDetails = cd?.email ?? null;

  type SessionWithCustomerEmail = Stripe.Checkout.Session & {
    customer_email?: string | null;
  };

  const customerEmail = (session as SessionWithCustomerEmail).customer_email;
  const emailFromCustomerEmail =
    typeof customerEmail === "string" ? customerEmail : null;

  return emailFromDetails ?? emailFromCustomerEmail ?? null;
}

async function enrichBookingAndSendConfirmation(args: {
  clerkUserId: string;
  writingSessionId: string;
  fallbackEmail?: string | null;
}) {
  const clerkEmail = await getClerkEmail(args.clerkUserId);
  const email = clerkEmail ?? args.fallbackEmail ?? null;

  if (!email) {
    console.error("No email found for booking enrichment", {
      clerkUserId: args.clerkUserId,
      writingSessionId: args.writingSessionId,
      fallbackEmail: args.fallbackEmail ?? null,
    });
  }

  const { data: sessionRow, error: sErr } = await supabaseAdmin
    .from("sessions")
    .select("id,title,starts_at")
    .eq("id", args.writingSessionId)
    .maybeSingle();

  if (sErr || !sessionRow) {
    console.error("Failed to load session during booking enrichment", {
      clerkUserId: args.clerkUserId,
      writingSessionId: args.writingSessionId,
      error: sErr?.message ?? "Session not found",
    });
    return { enriched: false };
  }

  const { data: bookingRow, error: bErr } = await supabaseAdmin
    .from("bookings")
    .select("id,confirmation_sent")
    .eq("session_id", args.writingSessionId)
    .eq("user_id", args.clerkUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bErr || !bookingRow) {
    console.error("Failed to load booking during enrichment", {
      clerkUserId: args.clerkUserId,
      writingSessionId: args.writingSessionId,
      error: bErr?.message ?? "Booking not found",
    });
    return { enriched: false };
  }

  await supabaseAdmin
    .from("bookings")
    .update({
      ...(email ? { user_email: email } : {}),
      reminder_24h_at: minusHours(sessionRow.starts_at, 24),
      reminder_1h_at: minusHours(sessionRow.starts_at, 1),
    })
    .eq("id", bookingRow.id);

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
    } catch (err: unknown) {
      console.error("Confirmation email failed", {
        clerkUserId: args.clerkUserId,
        writingSessionId: args.writingSessionId,
        email,
        error: getErrorMessage(err),
      });
    }
  }

  return { enriched: true };
}

async function refundPaymentIntent(args: {
  paymentIntentId: string | null;
  eventId: string;
  clerkUserId: string;
  writingSessionId: string;
  reason: string;
}) {
  if (!args.paymentIntentId) {
    return { refunded: false, reason: "no_payment_intent" as const };
  }

  await stripe.refunds.create(
    {
      payment_intent: args.paymentIntentId,
      reason: "requested_by_customer",
      metadata: {
        clerk_user_id: args.clerkUserId,
        writing_session_id: args.writingSessionId,
        failure_reason: args.reason.slice(0, 450),
        stripe_event_id: args.eventId,
      },
    },
    { idempotencyKey: `refund_${args.eventId}` }
  );

  return { refunded: true as const };
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

  const stripeEmail = getStripeCheckoutEmail(session);

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  const { data: timeRow, error: timeErr } = await supabaseAdmin
    .from("sessions")
    .select("starts_at")
    .eq("id", writingSessionId)
    .maybeSingle();

  if (timeErr || !timeRow?.starts_at) {
    return NextResponse.json(
      { error: "Could not load session start time" },
      { status: 500 }
    );
  }

  const startsAtMs = new Date(timeRow.starts_at).getTime();
  if (!Number.isFinite(startsAtMs)) {
    return NextResponse.json(
      { error: "Invalid session start time" },
      { status: 500 }
    );
  }

  const LATE_JOIN_GRACE_MS = 5 * 60_000;
  const latestAllowedMs = startsAtMs + LATE_JOIN_GRACE_MS;

  if (Date.now() > latestAllowedMs) {
    try {
      const refundRes = await refundPaymentIntent({
        paymentIntentId,
        eventId: event.id,
        clerkUserId,
        writingSessionId,
        reason: "too_late_after_start",
      });

      revalidatePath("/");

      return NextResponse.json({
        received: true,
        refunded: refundRes.refunded,
        reason: "too_late_after_start",
      });
    } catch (refundErr: unknown) {
      return NextResponse.json(
        { error: `Refund failed: ${getErrorMessage(refundErr)}` },
        { status: 500 }
      );
    }
  }

  const { error } = await supabaseAdmin.rpc("join_session", {
    p_session_id: writingSessionId,
    p_user_id: clerkUserId,
  });

  if (!error) {
    await enrichBookingAndSendConfirmation({
      clerkUserId,
      writingSessionId,
      fallbackEmail: stripeEmail,
    });

    revalidatePath("/");

    return NextResponse.json({ received: true, fulfilled: true });
  }

  const msg = String(error.message ?? "");

  if (looksLikeDuplicateOrAlreadyJoined(msg)) {
    await enrichBookingAndSendConfirmation({
      clerkUserId,
      writingSessionId,
      fallbackEmail: stripeEmail,
    });

    revalidatePath("/");

    return NextResponse.json({ received: true, deduped: true });
  }

  if (looksLikeCapacityOrJoinWindowFailure(msg)) {
    try {
      const refundRes = await refundPaymentIntent({
        paymentIntentId,
        eventId: event.id,
        clerkUserId,
        writingSessionId,
        reason: msg,
      });

      revalidatePath("/");

      return NextResponse.json({
        received: true,
        refunded: refundRes.refunded,
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