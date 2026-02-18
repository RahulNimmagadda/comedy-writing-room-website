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

  const label = useMemo(() => {
    if (disabled) return "Full";
    if (loading) return "Redirecting…";
    return `Pay ${formatUsd(priceCents)} to reserve spot`;
  }, [disabled, loading, priceCents]);

  const onClick = async () => {
    // Gate paid signup behind auth
    if (!isSignedIn) {
      const redirectUrl = encodeURIComponent(`/?signup=${sessionId}`);
      window.location.assign(`/sign-in?redirect_url=${redirectUrl}`);
      return;
    }

    try {
      setLoading(true);

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
