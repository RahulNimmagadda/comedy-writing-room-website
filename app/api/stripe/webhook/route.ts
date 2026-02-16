import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

  // In payment mode, payment_intent should exist. Needed for refunds.
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  // Try to fulfill booking via DB function (atomic)
  const { error } = await supabaseAdmin.rpc("join_session", {
    p_session_id: writingSessionId,
    p_user_id: clerkUserId,
  });

  if (!error) {
    return NextResponse.json({ received: true, fulfilled: true });
  }

  const msg = String(error.message ?? "");

  // Idempotency / retries: treat duplicate as success
  if (looksLikeDuplicateOrAlreadyJoined(msg)) {
    return NextResponse.json({ received: true, deduped: true });
  }

  // Capacity / timing issues: AUTO-REFUND, then return 200 so Stripe stops retrying
  if (looksLikeCapacityOrJoinWindowFailure(msg)) {
    if (!paymentIntentId) {
      // Can't refund without payment intent; still return 200 to prevent retries.
      // You may want to alert/log this.
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
          // Optional: pick a reason; Stripe allows these values:
          // 'duplicate' | 'fraudulent' | 'requested_by_customer'
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
