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
  } catch {
    return null;
  }
}

function getStripeCheckoutEmail(session: Stripe.Checkout.Session): string | null {
  const cd = session.customer_details as { email?: string | null } | null;
  const emailFromDetails = cd?.email ?? null;

  // Stripe type support varies by version; avoid `any` by widening with a safe type.
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
      ...(email ? { user_email: email } : {}),
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

  // Only handle checkout completion
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Only fulfill if actually paid
  if (session.payment_status !== "paid") {
    return NextResponse.json({
      received: true,
      ignored: "payment_status_not_paid",
    });
  }

  const clerkUserId = session.metadata?.clerk_user_id;
  const writingSessionId = session.metadata?.writing_session_id;

  if (!clerkUserId || !writingSessionId) {
    // Don't retry forever on permanently bad payloads
    return NextResponse.json({
      received: true,
      ignored: "missing_metadata",
    });
  }

  const stripeEmail = getStripeCheckoutEmail(session);

  // In payment mode, payment_intent should exist. Needed for refunds.
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  // Try to fulfill booking via DB function (atomic)
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

    // Make homepage reflect new booking ASAP
    revalidatePath("/");

    return NextResponse.json({ received: true, fulfilled: true });
  }

  const msg = String(error.message ?? "");

  // Idempotency / retries: treat duplicate as success
  if (looksLikeDuplicateOrAlreadyJoined(msg)) {
    await enrichBookingAndSendConfirmation({
      clerkUserId,
      writingSessionId,
      fallbackEmail: stripeEmail,
    });

    // Make homepage reflect booking ASAP
    revalidatePath("/");

    return NextResponse.json({ received: true, deduped: true });
  }

  // Capacity / timing issues: AUTO-REFUND, then return 200 so Stripe stops retrying
  if (looksLikeCapacityOrJoinWindowFailure(msg)) {
    if (!paymentIntentId) {
      // Can't refund without payment intent; still return 200 to prevent retries.
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
        // Idempotency key prevents double-refunds if Stripe retries this webhook
        { idempotencyKey: `refund_${event.id}` }
      );

      // Even if refunded, revalidate in case booking state changed elsewhere
      revalidatePath("/");

      return NextResponse.json({
        received: true,
        refunded: true,
        join_error: msg,
      });
    } catch (refundErr: unknown) {
      // If refund fails, return 500 so Stripe retries (we still want to try to refund)
      return NextResponse.json(
        { error: `Refund failed: ${getErrorMessage(refundErr)}`, join_error: msg },
        { status: 500 }
      );
    }
  }

  // Unknown failure: return 500 to trigger retry
  return NextResponse.json({ error: msg }, { status: 500 });
}