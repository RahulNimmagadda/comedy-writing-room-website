"use client";

import { useMemo, useRef, useState } from "react";
import LocalTime from "@/components/LocalTime";
import SessionActionButton from "@/components/SessionActionButton";

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

function sessionTypeFilterValue(
  priceCents: number
): Exclude<TypeFilter, "all"> {
  return priceCents >= 450 ? "pro" : "community";
}

function formatSelectedDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const localDate = new Date(year, (month ?? 1) - 1, day ?? 1);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(localDate);
}

function isSameLocalDay(isoString: string, selectedDate: string) {
  const sessionDate = new Date(isoString);
  const [year, month, day] = selectedDate.split("-").map(Number);

  return (
    sessionDate.getFullYear() === year &&
    sessionDate.getMonth() === month - 1 &&
    sessionDate.getDate() === day
  );
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
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateFilter, setDateFilter] = useState("");

  const dateInputRef = useRef<HTMLInputElement | null>(null);

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

      const matchesDate =
        dateFilter.length === 0 || isSameLocalDay(s.starts_at, dateFilter);

      return matchesQuery && matchesType && matchesDate;
    });
  }, [sessions, query, typeFilter, dateFilter]);

  const hasActiveFilters =
    query.trim().length > 0 || typeFilter !== "all" || dateFilter.length > 0;

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.click();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] border border-[#d8c3ad] bg-[#f7f0e6]/90 p-5 shadow-[0_24px_60px_rgba(58,36,23,0.08)] sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8c6a50]">
                Browse sessions
              </div>
              <div className="mt-2 max-w-2xl text-sm text-[#5d4e43]">
                Filter by title, type, or date. Past sessions stay hidden, and
                all reserve, pay, and join behavior remains unchanged.
              </div>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setTypeFilter("all");
                  setDateFilter("");
                }}
                className="inline-flex items-center justify-center rounded-full border border-[#d4b899] bg-white/85 px-3 py-1.5 text-sm font-medium text-[#2c1d15] transition hover:bg-white"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by session title"
              className="w-full rounded-full border border-[#d8c3ad] bg-white/92 px-4 py-3 text-sm text-[#1f1510] outline-none placeholder:text-[#9f8c7e] focus:border-[#b77a52]"
            />

            <div className="relative w-full">
              <button
                type="button"
                onClick={openDatePicker}
                className={`flex w-full items-center justify-between rounded-full border px-4 py-3 text-sm font-medium transition ${
                  dateFilter.length > 0
                    ? "border-[#1f1510] bg-[#1f1510] text-white hover:bg-[#31231b]"
                    : "border-[#d4b899] bg-white/85 text-[#2c1d15] hover:bg-white"
                }`}
              >
                <span>
                  {dateFilter ? formatSelectedDate(dateFilter) : "Select date"}
                </span>

                {dateFilter ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDateFilter("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setDateFilter("");
                      }
                    }}
                    className="ml-3 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs"
                    aria-label="Clear selected date"
                  >
                    ✕
                  </span>
                ) : (
                  <span aria-hidden className="ml-3">
                    📅
                  </span>
                )}
              </button>

              <input
                ref={dateInputRef}
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                typeFilter === "all"
                  ? "border-[#1f1510] bg-[#1f1510] text-white"
                  : "border-[#d4b899] bg-white/85 text-[#2c1d15] hover:bg-white"
              }`}
            >
              All Sessions
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter("community")}
              className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                typeFilter === "community"
                  ? "border-[#1f1510] bg-[#1f1510] text-white"
                  : "border-[#d4b899] bg-white/85 text-[#2c1d15] hover:bg-white"
              }`}
            >
              Community
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter("pro")}
              className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                typeFilter === "pro"
                  ? "border-[#1f1510] bg-[#1f1510] text-white"
                  : "border-[#d4b899] bg-white/85 text-[#2c1d15] hover:bg-white"
              }`}
            >
              Pro
            </button>
          </div>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="rounded-[2rem] border border-[#d8c3ad] bg-[#f7f0e6]/90 px-6 py-8 text-center shadow-[0_24px_60px_rgba(58,36,23,0.08)]">
          <div className="text-base font-medium text-[#1f1510]">
            {dateFilter.length > 0
              ? "No sessions on this date."
              : "No upcoming sessions match those filters."}
          </div>
          <div className="mt-1 text-sm text-[#5d4e43]">
            {dateFilter.length > 0
              ? "Try another day or clear filters."
              : "Try clearing filters or searching for something else."}
          </div>
        </div>
      ) : (
        filteredSessions.map((s) => {
          const type = sessionType(s.price_cents);
          const signupCount = seatsBySession[s.id] ?? 0;
          const isFree = (s.price_cents ?? 0) <= 0;
          const isJoined = joinedSet.has(s.id);

          return (
            <div
              key={s.id}
              className="rounded-[2rem] border border-[#d8c3ad] bg-[#fcf7f0]/92 p-5 shadow-[0_24px_60px_rgba(58,36,23,0.08)] sm:p-6"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-[#5d4e43]">
                    <span className="rounded-full border border-[#e4d5c1] bg-white/70 px-3 py-1 font-medium">
                      <LocalTime iso={s.starts_at} />
                    </span>

                    <span className="rounded-full border border-[#e4d5c1] bg-white/70 px-2.5 py-1 text-xs font-medium text-[#6b5648]">
                      {type}
                    </span>

                    {!isFree && (
                      <span className="rounded-full border border-[#e4d5c1] bg-white/70 px-2.5 py-1 text-xs font-medium text-[#6b5648]">
                        {formatUsd(s.price_cents)}
                      </span>
                    )}

                    <span className="rounded-full border border-[#e4d5c1] bg-white/70 px-2.5 py-1 text-xs font-medium text-[#6b5648]">
                      {s.duration_minutes} min
                    </span>

                    <span className="rounded-full border border-[#e4d5c1] bg-white/70 px-2.5 py-1 text-xs font-medium uppercase text-[#6b5648]">
                      {s.status}
                    </span>
                  </div>

                  <div className="font-serif text-3xl font-semibold tracking-tight text-[#1f1510]">
                    {s.title}
                  </div>

                  <div className="text-base text-[#4f4137]">
                    <span className="font-semibold">{signupCount}</span> comics
                    signed up
                  </div>

                  <div className="text-sm text-[#7d6a5d]">
                    Breakout rooms are created manually as needed.
                  </div>

                  {isJoined && (
                    <div className="text-sm text-[#7d6a5d]">
                      Join Room becomes available 5 minutes before start.
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  <SessionActionButton
                    sessionId={s.id}
                    startsAt={s.starts_at}
                    durationMinutes={s.duration_minutes}
                    priceCents={s.price_cents}
                    userId={userId}
                    isJoined={isJoined}
                    isAdmin={isAdmin}
                    variant="list"
                  />
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
