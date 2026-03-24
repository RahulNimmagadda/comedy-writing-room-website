"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PayButton from "@/components/PayButton";
import LocalTime from "@/components/LocalTime";

type SessionRow = {
  id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
  price_cents: number;
};

function sessionType(price: number) {
  return price >= 450 ? "Pro" : "Community";
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
  const [typeFilter, setTypeFilter] = useState<"all" | "pro" | "community">(
    "all"
  );

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      const matchesQuery =
        s.title.toLowerCase().includes(query.toLowerCase());

      const type = sessionType(s.price_cents).toLowerCase();

      const matchesType =
        typeFilter === "all" || type === typeFilter;

      return matchesQuery && matchesType;
    });
  }, [sessions, query, typeFilter]);

  return (
    <div className="space-y-6">
      {/* FILTER BAR */}
      <div className="border rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <input
          placeholder="Search sessions..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border px-3 py-2 rounded-lg w-full"
        />

        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as any)
          }
          className="border px-3 py-2 rounded-lg"
        >
          <option value="all">All</option>
          <option value="community">Community</option>
          <option value="pro">Pro</option>
        </select>
      </div>

      {/* SESSION LIST */}
      {filtered.map((s) => {
        const signupCount = seatsBySession[s.id] ?? 0;
        const isJoined = joinedSessionIds.includes(s.id);

        return (
          <div key={s.id} className="border rounded-xl p-5">
            <div className="space-y-2">
              <LocalTime iso={s.starts_at} />
              <div className="text-xl font-semibold">
                {s.title}
              </div>
              <div className="text-sm opacity-70">
                {signupCount} comics
              </div>
            </div>

            <div className="mt-4">
              {!userId ? (
                <Link
                  href="/sign-in"
                  className="bg-black text-white px-4 py-2 rounded-lg"
                >
                  Sign in
                </Link>
              ) : isJoined ? (
                <span className="text-sm">Reserved</span>
              ) : isAdmin ? (
                <button className="bg-black text-white px-4 py-2 rounded-lg">
                  Reserve
                </button>
              ) : (
                <PayButton
                  sessionId={s.id}
                  priceCents={s.price_cents}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}