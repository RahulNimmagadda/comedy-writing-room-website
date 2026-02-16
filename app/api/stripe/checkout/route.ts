import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as
      | null
      | { sessionId?: string };

    const sessionId = body?.sessionId;
    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_APP_URL env var" },
        { status: 500 }
      );
    }

    // OPTIONAL BUT STRONGLY RECOMMENDED:
    // Prevent creating checkout if user already booked
    const { data: existing } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Already signed up for this session" },
        { status: 400 }
      );
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 100, // $1.00
            product_data: {
              name: "Writing Room Session",
              description: "Reserve a spot for this session",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/sessions/success?cs_id={CHECKOUT_SESSION_ID}&session_id=${encodeURIComponent(
        sessionId
      )}`,
      cancel_url: `${appUrl}/?canceled=1`,
      metadata: {
        clerk_user_id: userId,
        writing_session_id: sessionId,
      },
    });

    if (!checkout.url) {
      return NextResponse.json(
        { error: "Stripe did not return checkout URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkout.url });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
        ? err
        : "Something went wrong";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
