"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PayButton from "@/components/PayButton";
import LocalTime from "@/components/LocalTime";
import { joinSession } from "@/app/sessions/actions";

type SessionRow = {
  id: string;
  title: string;
  starts_at: string; // UTC ISO
  duration_minutes: number;
  seat_cap: number;
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

// Treat <= $1.50 as Community, >= $4.50 as Pro (gives you flexibility if you change prices slightly)
function sessionType(priceCents: number) {
  if (!Number.isFinite(priceCents)) return "community";
  if (priceCents >= 450) return "pro";
  return "community";
}

function sessionTypeLabel(priceCents: number) {
  return sessionType(priceCents) === "pro" ? "Pro (moderated)" : "Community";
}

function dayKeyFromLocal(utcIso: string) {
  const d = new Date(utcIso);
  // Using user's local timezone intentionally
  return d.getDay(); // 0=Sun ... 6=Sat
}

function minutesFromLocalMidnight(utcIso: string) {
  const d = new Date(utcIso);
  return d.getHours() * 60 + d.getMinutes();
}

function isJoinWindowOpen(startsAtIso: string, durationMinutes: number) {
  const start = new Date(startsAtIso).getTime();
  const end = start + durationMinutes * 60_000;
  const now = Date.now();

  const openAt = start - 5 * 60_000;
  const closeAt = end + 10 * 60_000;

  return now >= openAt && now <= closeAt;
}

type Props = {
  sessions: SessionRow[];
  seatsBySession: Record<string, number>;
  joinedSessionIds: string[];
  userId: string | null;
  isAdmin: boolean;
};

const DAY_OPTIONS: { label: string; value: string }[] = [
  { label: "Any day", value: "any" },
  { label: "Sun", value: "0" },
  { label: "Mon", value: "1" },
  { label: "Tue", value: "2" },
  { label: "Wed", value: "3" },
  { label: "Thu", value: "4" },
  { label: "Fri", value: "5" },
  { label: "Sat", value: "6" },
];

type TimeBucket = "any" | "morning" | "afternoon" | "evening" | "late";
const TIME_OPTIONS: { label: string; value: TimeBucket; range: [number, number] }[] =
  [
    { label: "Any time", value: "any", range: [0, 24 * 60] },
    { label: "Morning (5a–12p)", value: "morning", range: [5 * 60, 12 * 60] },
    { label: "Afternoon (12p–5p)", value: "afternoon", range: [12 * 60, 17 * 60] },
    { label: "Evening (5p–10p)", value: "evening", range: [17 * 60, 22 * 60] },
    // “Late” wraps; we handle separately
    { label: "Late (10p–5a)", value: "late", range: [22 * 60, 5 * 60] },
  ];

type PriceFilter = "all" | "community" | "pro";

export default function SessionsBrowser({
  sessions,
  seatsBySession,
  joinedSessionIds,
  userId,
  isAdmin,
}: Props) {
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [dayFilter, setDayFilter] = useState<string>("any");
  const [timeFilter, setTimeFilter] = useState<TimeBucket>("any");

  const joinedSet = useMemo(() => new Set(joinedSessionIds), [joinedSessionIds]);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      // price/type filter
      if (priceFilter !== "all") {
        if (sessionType(s.price_cents) !== priceFilter) return false;
      }

      // day filter (viewer local)
      if (dayFilter !== "any") {
        const dk = dayKeyFromLocal(s.starts_at);
        if (String(dk) !== dayFilter) return false;
      }

      // time bucket filter (viewer local)
      if (timeFilter !== "any") {
        const mins = minutesFromLocalMidnight(s.starts_at);
        if (timeFilter === "late") {
          // 10p–midnight OR midnight–5a
          if (!(mins >= 22 * 60 || mins < 5 * 60)) return false;
        } else {
          const opt = TIME_OPTIONS.find((o) => o.value === timeFilter);
          if (!opt) return true;
          const [start, end] = opt.range;
          if (mins < start || mins >= end) return false;
        }
      }

      return true;
    });
  }, [sessions, priceFilter, dayFilter, timeFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-2xl border border-zinc-200/70 bg-white/70 px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Session type pill toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPriceFilter("all")}
              className={`rounded-xl px-3 py-2 text-sm font-semibold border transition ${
                priceFilter === "all"
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white/60 text-zinc-900 border-zinc-200 hover:bg-white"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setPriceFilter("community")}
              className={`rounded-xl px-3 py-2 text-sm font-semibold border transition ${
                priceFilter === "community"
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white/60 text-zinc-900 border-zinc-200 hover:bg-white"
              }`}
            >
              Community ($1)
            </button>
            <button
              type="button"
              onClick={() => setPriceFilter("pro")}
              className={`rounded-xl px-3 py-2 text-sm font-semibold border transition ${
                priceFilter === "pro"
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white/60 text-zinc-900 border-zinc-200 hover:bg-white"
              }`}
            >
              Pro ($5)
            </button>
          </div>

          {/* Day + time */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-600">Day</span>
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white/60 px-3 py-2 text-sm"
              >
                {DAY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-600">Time</span>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeBucket)}
                className="rounded-xl border border-zinc-200 bg-white/60 px-3 py-2 text-sm"
              >
                {TIME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-zinc-500 sm:pl-2">
              Showing <span className="font-semibold">{filtered.length}</span>
            </div>
          </div>
        </div>

        {/* One-line explanation */}
        <div className="mt-3 text-xs text-zinc-600">
          <span className="font-semibold">Community:</span> cheaper + less structured.
          <span className="mx-2">•</span>
          <span className="font-semibold">Pro:</span> moderated + capped at 5.
        </div>
      </div>

      {/* Sessions list */}
      <div className="space-y-3">
        {filtered.map((s) => {
          const seats = seatsBySession[s.id] ?? 0;

          const type = sessionType(s.price_cents);
          const totalCap = type === "pro" ? s.seat_cap : s.seat_cap * 5; // Pro is “one room”
          const isFull = seats >= totalCap;

          const alreadyJoined = userId ? joinedSet.has(s.id) : false;
          const canJoinNow = isJoinWindowOpen(s.starts_at, s.duration_minutes);

          const priceLabel =
            Number.isFinite(s.price_cents) && s.price_cents > 0
              ? formatUsd(s.price_cents)
              : "";

          const typeBadge =
            type === "pro" ? (
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white/60 px-2 py-0.5 text-xs font-semibold text-zinc-900">
                Pro (moderated)
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white/60 px-2 py-0.5 text-xs font-semibold text-zinc-900">
                Community
              </span>
            );

          return (
            <div
              key={s.id}
              className="rounded-2xl border border-zinc-200/70 bg-white/70 px-6 py-5 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                {/* Left */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm text-zinc-500">
                      <LocalTime iso={s.starts_at} />
                    </div>

                    {typeBadge}

                    {priceLabel ? (
                      <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white/60 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {priceLabel}
                      </span>
                    ) : null}

                    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white/60 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {s.duration_minutes} min
                    </span>

                    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white/60 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {s.status}
                    </span>
                  </div>

                  <div className="mt-2 text-lg font-semibold tracking-tight text-zinc-900 truncate">
                    {s.title}
                  </div>

                  <div className="mt-2 text-sm text-zinc-600">
                    <span className="font-semibold text-zinc-900">{seats}</span>{" "}
                    comics signed up
                    {isFull ? (
                      <span className="ml-2 text-zinc-500">(Full)</span>
                    ) : null}
                    <span className="ml-2 text-zinc-500">
                      • cap {totalCap}
                    </span>
                  </div>

                  {type !== "pro" && seats > 5 && (
                    <div className="mt-2 text-xs text-zinc-500">
                      Each room is capped at 5 people. Rooms split automatically
                      as more comics join.
                    </div>
                  )}

                  {type === "pro" && (
                    <div className="mt-2 text-xs text-zinc-500">
                      Moderated session. Strict 5-person cap to keep feedback high-signal.
                    </div>
                  )}
                </div>

                {/* Right actions */}
                <div className="shrink-0">
                  {alreadyJoined ? (
                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                      <div className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white/60 px-3 py-2 text-sm font-semibold text-zinc-900">
                        Reserved ✅
                      </div>

                      <Link
                        href={`/sessions/${s.id}/join`}
                        className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition ${
                          canJoinNow
                            ? "bg-amber-500 hover:bg-amber-400 active:bg-amber-500/90"
                            : "bg-zinc-200/70 text-zinc-500 pointer-events-none"
                        }`}
                      >
                        Join Room
                      </Link>

                      <div className="text-xs text-zinc-500">
                        {canJoinNow
                          ? "Room is open — join now"
                          : "Opens 5 minutes before start"}
                      </div>
                    </div>
                  ) : !userId ? (
                    <Link
                      href={`/sign-in?redirect_url=${encodeURIComponent("/")}`}
                      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition ${
                        isFull
                          ? "bg-zinc-200/70 text-zinc-500 pointer-events-none"
                          : "bg-amber-500 hover:bg-amber-400 active:bg-amber-500/90"
                      }`}
                    >
                      {isFull
                        ? "Full"
                        : `Sign in to reserve${
                            s.price_cents > 0 ? ` (${formatUsd(s.price_cents)})` : ""
                          }`}
                    </Link>
                  ) : isAdmin ? (
                    <form action={joinSession}>
                      <input type="hidden" name="sessionId" value={s.id} />
                      <button
                        className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-40 transition"
                        disabled={isFull}
                      >
                        {isFull ? "Full" : "Admin: Reserve Free"}
                      </button>
                    </form>
                  ) : (
                    <div className={isFull ? "opacity-60 pointer-events-none" : ""}>
                      <PayButton
                        sessionId={s.id}
                        priceCents={s.price_cents}
                        disabled={isFull}
                      />
                      {isFull && (
                        <div className="mt-2 text-xs text-zinc-500 text-center">
                          This session is full.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-zinc-200/70 bg-white/60 p-6 text-sm text-zinc-600">
            No sessions match those filters.
          </div>
        )}
      </div>
    </div>
  );
}
