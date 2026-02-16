import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as null | { sessionId?: string };
  const sessionId = body?.sessionId;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
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
    cancel_url: `${appUrl}/sessions/${encodeURIComponent(sessionId)}?canceled=1`,
    metadata: {
      clerk_user_id: userId,
      writing_session_id: sessionId,
    },
  });

  return NextResponse.json({ url: checkout.url });
}
