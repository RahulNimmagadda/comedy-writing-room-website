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
  seat_cap?: number | null;
  status: string;
  price_cents: number;
};

function formatUsd(cents: number) {
  const safe = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(safe / 100);
}

function sessionType(priceCents: number) {
  if (!Number.isFinite(priceCents)) return "Community";
  if (priceCents >= 450) return "Pro";
  return "Community";
}

export default function SessionsBrowser({
  sessions,
  seatsBySession = {},
  joinedSessionIds = [],
  userId = null,
  isAdmin = false,
}: {
  sessions: SessionRow[];
  seatsBySession?: Record<string, number>;
  joinedSessionIds?: string[];
  userId?: string | null;
  isAdmin?: boolean;
}) {
  const [state, formAction] = useActionState<JoinSessionResult | null, FormData>(
    joinSession,
    null
  );

  return (
    <div className="space-y-4">
      {sessions.map((s) => {
        const type = sessionType(s.price_cents);
        const signupCount = seatsBySession[s.id] ?? 0;
        const isFree = (s.price_cents ?? 0) <= 0;
        const isJoined = joinedSessionIds.includes(s.id);
        const canReserveDirectly = isFree || isAdmin;

        return (
          <div key={s.id} className="border rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm opacity-80">
                  <LocalTime iso={s.starts_at} />
                  <span className="px-2 py-0.5 border rounded-full">
                    {type}
                  </span>
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

                <div className="text-base">
                  <span className="font-semibold">{signupCount}</span> comics
                  signed up
                </div>

                <div className="text-sm opacity-70">
                  Breakout rooms are created manually as needed.
                </div>
              </div>

              <div className="shrink-0">
                {!userId ? (
                  <a
                    href="/sign-in"
                    className="inline-block bg-black text-white px-4 py-3 rounded-lg"
                  >
                    Sign in to reserve
                  </a>
                ) : isJoined ? (
                  <button
                    type="button"
                    disabled
                    className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg cursor-default"
                  >
                    Reserved
                  </button>
                ) : canReserveDirectly ? (
                  <form action={formAction}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <button className="bg-black text-white px-4 py-3 rounded-lg">
                      {isFree ? "Reserve spot (Free)" : "Reserve spot"}
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