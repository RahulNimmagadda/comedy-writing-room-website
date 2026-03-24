"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, useSyncExternalStore } from "react";
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

type TypeFilter = "all" | "community" | "pro";

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

function sessionTypeFilterValue(priceCents: number): Exclude<TypeFilter, "all"> {
  return priceCents >= 450 ? "pro" : "community";
}

async function joinSessionAction(
  _state: JoinSessionResult | null,
  formData: FormData
): Promise<JoinSessionResult> {
  return joinSession(formData);
}

function getSessionTiming(startsAtIso: string, durationMinutes: number) {
  const startMs = new Date(startsAtIso).getTime();
  const endMs = startMs + durationMinutes * 60_000;

  return {
    startMs,
    endMs,
    joinOpensAtMs: startMs - 5 * 60_000,
    reserveClosesAtMs: startMs + 5 * 60_000,
  };
}

function subscribeNow(callback: () => void) {
  const interval = setInterval(callback, 15_000);
  return () => clearInterval(interval);
}

function getNowSnapshot() {
  return Date.now();
}

function getServerNowSnapshot() {
  return 0;
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
  const [state, formAction] = useActionState(joinSessionAction, null);
  const nowMs = useSyncExternalStore(
    subscribeNow,
    getNowSnapshot,
    getServerNowSnapshot
  );

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const joinedSet = useMemo(() => new Set(joinedSessionIds), [joinedSessionIds]);

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sessions.filter((s) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        s.title.toLowerCase().includes(normalizedQuery);

      const matchesType =
        typeFilter === "all" ||
        sessionTypeFilterValue(s.price_cents) === typeFilter;

      return matchesQuery && matchesType;
    });
  }, [sessions, query, typeFilter]);

  const hasActiveFilters = query.trim().length > 0 || typeFilter !== "all";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-amber-950">
                🔎 Filter sessions
              </div>
              <div className="mt-1 text-xs text-amber-900/80">
                Community: $1 — for the people! • Pro: $5 — vetted moderators,
                for serious comics
              </div>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setTypeFilter("all");
                }}
                className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-white/80 px-3 py-1.5 text-sm font-medium text-amber-950 transition hover:bg-white"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by session title"
              className="w-full rounded-xl border border-amber-200 bg-white/90 px-4 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-amber-400"
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  typeFilter === "all"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-amber-300 bg-white/80 text-zinc-800 hover:bg-white"
                }`}
              >
                All
              </button>

              <button
                type="button"
                onClick={() => setTypeFilter("community")}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  typeFilter === "community"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-amber-300 bg-white/80 text-zinc-800 hover:bg-white"
                }`}
              >
                Community
              </button>

              <button
                type="button"
                onClick={() => setTypeFilter("pro")}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  typeFilter === "pro"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-amber-300 bg-white/80 text-zinc-800 hover:bg-white"
                }`}
              >
                Pro
              </button>
            </div>
          </div>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200/70 bg-white/70 px-6 py-8 text-center shadow-sm">
          <div className="text-base font-medium text-zinc-900">
            No sessions match those filters.
          </div>
          <div className="mt-1 text-sm text-zinc-600">
            Try clearing filters or searching for something else.
          </div>
        </div>
      ) : (
        filteredSessions.map((s) => {
          const type = sessionType(s.price_cents);
          const signupCount = seatsBySession[s.id] ?? 0;
          const isFree = (s.price_cents ?? 0) <= 0;
          const isJoined = joinedSet.has(s.id);
          const canReserveDirectly = isFree || isAdmin;

          const { startMs, endMs, joinOpensAtMs, reserveClosesAtMs } =
            getSessionTiming(s.starts_at, s.duration_minutes);

          const hasLiveNow = nowMs > 0;
          const isEnded = hasLiveNow && nowMs > endMs;
          const isInProgress =
            hasLiveNow && nowMs > reserveClosesAtMs && nowMs <= endMs;
          const canJoinNow =
            hasLiveNow &&
            isJoined &&
            nowMs >= joinOpensAtMs &&
            nowMs <= reserveClosesAtMs;
          const canReserveNow = !hasLiveNow || nowMs <= reserveClosesAtMs;
          const isHappeningSoon =
            hasLiveNow && startMs > nowMs && startMs - nowMs <= 24 * 60 * 60_000;

          return (
            <div
              key={s.id}
              className="rounded-2xl border border-zinc-200/70 bg-white/80 p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                    <LocalTime iso={s.starts_at} />

                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      {type}
                    </span>

                    {!isFree && (
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                        {formatUsd(s.price_cents)}
                      </span>
                    )}

                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      {s.duration_minutes} min
                    </span>

                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      {s.status}
                    </span>

                    {isHappeningSoon && (
                      <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-950">
                        Happening Soon
                      </span>
                    )}
                  </div>

                  <div className="text-2xl font-semibold tracking-tight text-zinc-950">
                    {s.title}
                  </div>

                  <div className="text-base text-zinc-700">
                    <span className="font-semibold">{signupCount}</span> comics
                    signed up
                  </div>

                  <div className="text-sm text-zinc-500">
                    Breakout rooms are created manually as needed.
                  </div>

                  {isJoined && !canJoinNow && !isInProgress && !isEnded && (
                    <div className="text-sm text-zinc-500">
                      Join Room becomes available 5 minutes before start.
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {isEnded ? (
                    <button
                      type="button"
                      disabled
                      className="cursor-default rounded-xl bg-gray-200 px-4 py-3 text-gray-700"
                    >
                      Session Ended
                    </button>
                  ) : isInProgress ? (
                    <button
                      type="button"
                      disabled
                      className="cursor-default rounded-xl bg-gray-200 px-4 py-3 text-gray-700"
                    >
                      Session in progress
                    </button>
                  ) : canJoinNow ? (
                    <Link
                      href={`/sessions/${s.id}/join`}
                      className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 font-medium text-white transition hover:bg-zinc-800"
                    >
                      Join Room
                    </Link>
                  ) : !userId ? (
                    <Link
                      href="/sign-in"
                      className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 font-medium text-white transition hover:bg-zinc-800"
                    >
                      Sign in to reserve
                    </Link>
                  ) : isJoined ? (
                    <button
                      type="button"
                      disabled
                      className="cursor-default rounded-xl bg-gray-200 px-4 py-3 text-gray-700"
                    >
                      Reserved
                    </button>
                  ) : !canReserveNow ? (
                    <button
                      type="button"
                      disabled
                      className="cursor-default rounded-xl bg-gray-200 px-4 py-3 text-gray-700"
                    >
                      Session in progress
                    </button>
                  ) : canReserveDirectly ? (
                    <form action={formAction}>
                      <input type="hidden" name="sessionId" value={s.id} />
                      <button className="rounded-xl bg-black px-4 py-3 font-medium text-white transition hover:bg-zinc-800">
                        {isFree
                          ? "Reserve spot (Free)"
                          : `Reserve – ${formatUsd(s.price_cents)}`}
                      </button>
                    </form>
                  ) : (
                    <PayButton sessionId={s.id} priceCents={s.price_cents} />
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {state && !state.ok && (
        <div className="text-sm text-red-600">{state.error}</div>
      )}
    </div>
  );
}