import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  // Stripe requires the *raw* request body for signature verification
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  // We care about successful checkout completion
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const clerkUserId = session.metadata?.clerk_user_id;
    const writingSessionId = session.metadata?.writing_session_id;

    if (!clerkUserId || !writingSessionId) {
      return NextResponse.json({ error: "Missing metadata on checkout session" }, { status: 400 });
    }

    // Only book if Stripe says it is paid
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true, ignored: "payment_status_not_paid" });
    }

    // Insert booking (idempotent via unique index)
    const { error } = await supabaseAdmin.from("bookings").insert({
      session_id: writingSessionId,
      user_id: clerkUserId,
    });

    // Ignore duplicates (webhooks can retry)
    if (error && !String(error.message).toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
