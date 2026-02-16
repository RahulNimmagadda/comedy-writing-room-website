"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

export default function PayButton({
  sessionId,
  disabled,
}: {
  sessionId: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const { isSignedIn } = useAuth();

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
      {disabled ? "Full" : loading ? "Redirecting…" : "Pay $1 to sign up"}
    </button>
  );
}
