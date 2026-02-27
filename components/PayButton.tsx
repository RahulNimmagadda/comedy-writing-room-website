"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";

function formatUsd(cents: number) {
  const safe = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(safe / 100);
}

function getClientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

type Json = Record<string, unknown>;

function safeJsonParse(text: string): Json | null {
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? (v as Json) : null;
  } catch {
    return null;
  }
}

export default function PayButton({
  sessionId,
  priceCents,
  disabled,
}: {
  sessionId: string;
  priceCents: number;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const { isSignedIn } = useAuth();

  const isFree = useMemo(() => {
    const n = Number(priceCents ?? 0);
    return Number.isFinite(n) && n <= 0;
  }, [priceCents]);

  const label = useMemo(() => {
    if (disabled) return "Full";
    if (loading) return isFree ? "Reserving…" : "Redirecting…";
    if (isFree) return "Reserve spot (Free)";
    return `Pay ${formatUsd(priceCents)} to reserve spot`;
  }, [disabled, loading, isFree, priceCents]);

  const onClick = async () => {
    // Gate signup behind auth (free or paid)
    if (!isSignedIn) {
      const redirectUrl = encodeURIComponent(`/?signup=${sessionId}`);
      window.location.assign(`/sign-in?redirect_url=${redirectUrl}`);
      return;
    }

    try {
      setLoading(true);

      // ---- FREE FLOW (non-Stripe) ----
      if (isFree) {
        const timezone = getClientTimezone();

        const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone }),
          redirect: "follow",
        });

        // If the route handler performs a redirect, respect it
        if (res.redirected) {
          window.location.assign(res.url);
          return;
        }

        const text = await res.text();
        const data = safeJsonParse(text);

        if (!res.ok) {
          const msg =
            (data?.error && String(data.error)) ||
            text ||
            "Failed to reserve spot";
          throw new Error(msg);
        }

        // Common patterns: { url } / { redirectTo } / { ok: true }
        const url =
          (data?.url && String(data.url)) ||
          (data?.redirectTo && String(data.redirectTo)) ||
          null;

        if (url) {
          window.location.assign(url);
          return;
        }

        // If no explicit redirect, just refresh so UI reflects reserved state
        window.location.reload();
        return;
      }

      // ---- PAID FLOW (Stripe checkout) ----
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      window.location.assign(data.url);
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "string"
          ? e
          : "Something went wrong";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="px-3 py-2 rounded bg-black text-white disabled:opacity-40"
    >
      {label}
    </button>
  );
}