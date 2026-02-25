import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";

type Body = { sessionId?: string };

function getBaseUrl(req: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (envUrl) return envUrl.replace(/\/$/, "");

  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`.replace(/\/$/, "");

  throw new Error("Could not determine base URL for Stripe redirect.");
}

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const sessionId = String(body.sessionId ?? "").trim();
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const { data: sessionRow, error: sessionErr } = await supabaseAdmin
      .from("sessions")
      .select("id,title,price_cents,status")
      .eq("id", sessionId)
      .single();

    if (sessionErr) {
      return NextResponse.json({ error: sessionErr.message }, { status: 400 });
    }

    if (!sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (sessionRow.status !== "scheduled") {
      return NextResponse.json(
        { error: "This session is not available for purchase." },
        { status: 400 }
      );
    }

    const priceCents = Number(sessionRow.price_cents);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return NextResponse.json(
        { error: "Invalid session price." },
        { status: 400 }
      );
    }

    if (priceCents === 0) {
      return NextResponse.json(
        {
          error:
            "This session price is $0. If you want free signup, implement a non-Stripe join flow.",
        },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl(req);

    // Optional redundancy: include Checkout Session ID so you can debug/verify on return
    const successUrl = `${baseUrl}/?signup=${encodeURIComponent(
      sessionId
    )}&paid=1&cs_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl = `${baseUrl}/?signup=${encodeURIComponent(sessionId)}&c=1`;

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: `${userId}:${sessionId}`,

      // 🔥 IMPORTANT: these keys MUST match what your webhook expects
      metadata: {
        clerk_user_id: userId,
        writing_session_id: sessionId,
      },

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: priceCents,
            product_data: {
              name: sessionRow.title || "Writing Room Session",
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : typeof e === "string"
        ? e
        : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}