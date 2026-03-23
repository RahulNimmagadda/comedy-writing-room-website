"use client";

import { useActionState } from "react";
import PayButton from "@/components/PayButton";
import LocalTime from "@/components/LocalTime";
import { joinSession, type JoinSessionResult } from "@/app/sessions/actions";

type SessionRow = {
  id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
  price_cents: number;
  signup_count?: number;
};

function formatUsd(cents: number) {
  const safe = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(safe / 100);
}

function sessionType(priceCents: number) {
  if (!Number.isFinite(priceCents)) return "community";
  if (priceCents >= 450) return "pro";
  return "community";
}

export default function SessionsBrowser({
  sessions,
}: {
  sessions: SessionRow[];
}) {
  const [state, formAction] = useActionState<JoinSessionResult | null, FormData>(
    joinSession,
    null
  );

  return (
    <div className="space-y-4">
      {sessions.map((s) => {
        const type = sessionType(s.price_cents);
        const isFree = (s.price_cents ?? 0) <= 0;

        return (
          <div
            key={s.id}
            className="border rounded-2xl p-6 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm opacity-80">
                  <LocalTime iso={s.starts_at} />
                  <span className="px-2 py-0.5 border rounded-full">{type === "pro" ? "Pro" : "Community"}</span>
                  {!isFree && (
                    <span className="px-2 py-0.5 border rounded-full">
                      {formatUsd(s.price_cents)}
                    </span>
                  )}
                  <span className="px-2 py-0.5 border rounded-full">
                    {s.duration_minutes} min
                  </span>
                  <span className="px-2 py-0.5 border rounded-full">
                    {s.status}
                  </span>
                </div>

                <div className="text-2xl font-semibold">{s.title}</div>

                {typeof s.signup_count === "number" && (
                  <div className="text-base">
                    <span className="font-semibold">{s.signup_count}</span>{" "}
                    comics signed up
                  </div>
                )}

                <div className="text-sm opacity-70">
                  Rooms are split manually with breakout rooms as needed.
                </div>
              </div>

              <div className="shrink-0">
                {isFree ? (
                  <form action={formAction}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <button className="bg-black text-white px-4 py-3 rounded-lg">
                      Reserve spot
                    </button>
                  </form>
                ) : (
                  <PayButton sessionId={s.id} />
                )}
              </div>
            </div>
          </div>
        );
      })}

      {state && !state.ok && (
        <div className="text-sm text-red-600">{state.error}</div>
      )}
    </div>
  );
}