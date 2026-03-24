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

function safeErrorMessage(x: unknown, fallback: string) {
  if (typeof x === "string" && x.trim()) return x;
  if (x instanceof Error && x.message.trim()) return x.message;

  if (x && typeof x === "object") {
    const anyX = x as Record<string, unknown>;
    const maybeError = anyX.error;
    const maybeMessage = anyX.message;
    if (typeof maybeError === "string" && maybeError.trim()) return maybeError;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
  }

  return fallback;
}

function getClientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
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

  const label = useMemo(() => {
    if (disabled) return "Full";
    if (loading) return "Working…";
    return `Pay ${formatUsd(priceCents)} to reserve spot`;
  }, [disabled, loading, priceCents]);

  const ensureSignedIn = () => {
    if (!isSignedIn) {
      const redirectUrl = encodeURIComponent(`/?signup=${sessionId}`);
      window.location.assign(`/sign-in?redirect_url=${redirectUrl}`);
      return false;
    }
    return true;
  };

  const onClick = async () => {
    if (!ensureSignedIn()) return;

    try {
      setLoading(true);

      const tz = getClientTimezone();

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          timezone: tz,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Failed to create checkout session");
      }

      window.location.assign(data.url);
    } catch (e: unknown) {
      alert(safeErrorMessage(e, "Something went wrong"));
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