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

function sessionType(priceCents: number) {
  if (!Number.isFinite(priceCents)) return "community";
  if (priceCents >= 450) return "pro";
  return "community";
}

function dayKeyFromLocal(utcIso: string) {
  const d = new Date(utcIso);
  return d.getDay();
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
    { label: "Late (10p–5a)", value: "late", range: [22 * 60, 5 * 60] },
  ];

type PriceFilter = "all" | "community" | "pro";

type FilterControlsProps = {
  compact: boolean;
  priceFilter: PriceFilter;
  setPriceFilter: (v: PriceFilter) => void;
  dayFilter: string;
  setDayFilter: (v: string) => void;
  timeFilter: TimeBucket;
  setTimeFilter: (v: TimeBucket) => void;
};

function FilterControls({
  compact,
  priceFilter,
  setPriceFilter,
  dayFilter,
  setDayFilter,
  timeFilter,
  setTimeFilter,
}: FilterControlsProps) {
  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All"],
            ["community", "Community ($1)"],
            ["pro", "Pro ($5)"],
          ] as const
        ).map(([key, label]) => {
          const active = priceFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setPriceFilter(key)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white/80 text-zinc-900 border-zinc-300 hover:bg-white"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-300 bg-white/80 px-3 py-2">
          <span className="text-xs font-semibold text-zinc-700">Day</span>
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="bg-transparent text-sm text-zinc-900 outline-none"
          >
            {DAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-300 bg-white/80 px-3 py-2">
          <span className="text-xs font-semibold text-zinc-700">Time</span>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as TimeBucket)}
            className="bg-transparent text-sm text-zinc-900 outline-none"
          >
            {TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="text-sm text-zinc-700">
        <span className="font-semibold">Community:</span> $1 - for the people!
        <span className="mx-2">•</span>
        <span className="font-semibold">Pro:</span> $5 - Vetted moderators, for serious comics
      </div>
    </div>
  );
}

type Props = {
  sessions: SessionRow[];
  seatsBySession: Record<string, number>;
  joinedSessionIds: string[];
  userId: string | null;
  isAdmin: boolean;
};

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
      if (priceFilter !== "all") {
        if (sessionType(s.price_cents) !== priceFilter) return false;
      }

      if (dayFilter !== "any") {
        const dk = dayKeyFromLocal(s.starts_at);
        if (String(dk) !== dayFilter) return false;
      }

      if (timeFilter !== "any") {
        const mins = minutesFromLocalMidnight(s.starts_at);
        if (timeFilter === "late") {
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

  const canClear = priceFilter !== "all" || dayFilter !== "any" || timeFilter !== "any";
  const activeFiltersCount =
    (priceFilter !== "all" ? 1 : 0) +
    (dayFilter !== "any" ? 1 : 0) +
    (timeFilter !== "any" ? 1 : 0);

  function clearFilters() {
    setPriceFilter("all");
    setDayFilter("any");
    setTimeFilter("any");
  }

  const listKey = `${priceFilter}|${dayFilter}|${timeFilter}`;

  return (
    <div className="space-y-4">
      {/* Sticky wrapper */}
      <div className="sticky top-3 z-20">
        {/* MOBILE: tinted filter card */}
        <div className="sm:hidden rounded-2xl border border-amber-200/80 bg-amber-50/70 shadow-sm ring-1 ring-amber-200/60 backdrop-blur">
          <details className="group">
            <summary className="list-none cursor-pointer px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-amber-950 font-bold">
                    🔎 Filter sessions
                    {activeFiltersCount > 0 ? (
                      <span className="ml-2 inline-flex items-center rounded-full border border-amber-200 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
                        {activeFiltersCount} active
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-xs text-amber-900/80">
                    Showing <span className="font-semibold">{filtered.length}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canClear && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        clearFilters();
                      }}
                      className="rounded-xl border border-amber-200 bg-white/70 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-white transition"
                    >
                      Clear
                    </button>
                  )}

                  <span className="text-xs font-semibold text-amber-950">
                    <span className="group-open:hidden">Open ▾</span>
                    <span className="hidden group-open:inline">Close ▴</span>
                  </span>
                </div>
              </div>
            </summary>

            <div className="px-4 pb-4">
              <FilterControls
                compact={true}
                priceFilter={priceFilter}
                setPriceFilter={setPriceFilter}
                dayFilter={dayFilter}
                setDayFilter={setDayFilter}
                timeFilter={timeFilter}
                setTimeFilter={setTimeFilter}
              />
            </div>
          </details>
        </div>

        {/* DESKTOP: tinted filter card */}
        <div className="hidden sm:block rounded-2xl border border-amber-200/80 bg-amber-50/60 shadow-sm ring-1 ring-amber-200/60 backdrop-blur">
          <div className="flex gap-4 px-5 py-4">
            <div className="w-1 rounded-full bg-amber-400" />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-amber-950 font-bold">
                    🔎 Filter sessions
                  </div>
                  <div className="mt-0.5 text-sm text-amber-900/80">
                    Find the right room by type, day, or time.
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-xs text-amber-900/80">
                    Showing <span className="font-semibold">{filtered.length}</span>
                  </div>

                  {canClear && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="shrink-0 rounded-xl border border-amber-200 bg-white/70 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-white transition"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <FilterControls
                  compact={false}
                  priceFilter={priceFilter}
                  setPriceFilter={setPriceFilter}
                  dayFilter={dayFilter}
                  setDayFilter={setDayFilter}
                  timeFilter={timeFilter}
                  setTimeFilter={setTimeFilter}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions list */}
      <div key={listKey} className="space-y-3 animate-in fade-in-0 zoom-in-95 duration-200">
        {filtered.map((s) => {
          const seats = seatsBySession[s.id] ?? 0;

          const type = sessionType(s.price_cents);
          const totalCap = type === "pro" ? s.seat_cap : s.seat_cap * 5;
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
              className="rounded-2xl border border-zinc-200/70 bg-white/70 px-4 py-4 sm:px-6 sm:py-5 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                {/* Left */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs sm:text-sm text-zinc-600">
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

                  <div className="mt-2 text-base sm:text-lg font-semibold tracking-tight text-zinc-900 truncate">
                    {s.title}
                  </div>

                  <div className="mt-2 text-sm text-zinc-700">
                    <span className="font-semibold text-zinc-900">{seats}</span>{" "}
                    comics signed up
                    {isFull ? <span className="ml-2 text-zinc-500">(Full)</span> : null}
                    <span className="ml-2 text-zinc-500">• cap {totalCap}</span>
                  </div>

                  <div className="hidden sm:block">
                    {type !== "pro" && seats > 5 && (
                      <div className="mt-2 text-xs text-zinc-500">
                        Each room is capped at 5 people. Rooms split automatically as more comics join.
                      </div>
                    )}
                    {type === "pro" && (
                      <div className="mt-2 text-xs text-zinc-500">
                        Moderated session. Strict 5-person cap to keep feedback high-signal.
                      </div>
                    )}
                  </div>
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
                        {canJoinNow ? "Room is open — join now" : "Opens 5 minutes before start"}
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
                      <PayButton sessionId={s.id} priceCents={s.price_cents} disabled={isFull} />
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