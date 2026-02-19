import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Link from "next/link";
import SessionsBrowser from "@/components/SessionsBrowser";

type SessionRow = {
  id: string;
  title: string;
  starts_at: string; // UTC ISO in DB
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

export default async function HomePage() {
  const { userId } = auth();

  const isAdmin =
    !!userId &&
    (process.env.ADMIN_USER_IDS?.split(",")
      .map((s) => s.trim())
      .includes(userId) ??
      false);

  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("sessions")
    .select("id,title,starts_at,duration_minutes,seat_cap,status,price_cents")
    .order("starts_at", { ascending: true });

  if (sessionsError) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Writing Sessions
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Something went wrong loading sessions.
            </p>
          </div>
        </div>

        <pre className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 text-xs text-zinc-800 overflow-auto">
          {JSON.stringify(sessionsError, null, 2)}
        </pre>
      </div>
    );
  }

  const typedSessions = (sessions ?? []) as SessionRow[];
  const sessionIds = typedSessions.map((s) => s.id);

  // For generic copy at top (if prices differ per session, this will be "from $X")
  const prices = typedSessions
    .map((s) => Number(s.price_cents))
    .filter((n) => Number.isFinite(n) && n > 0);
  const minPriceCents = prices.length ? Math.min(...prices) : 0;
  const maxPriceCents = prices.length ? Math.max(...prices) : 0;

  const priceSummary =
    minPriceCents === 0
      ? ""
      : minPriceCents === maxPriceCents
      ? `${formatUsd(minPriceCents)}`
      : `from ${formatUsd(minPriceCents)}`;

  // Compute seats + whether current user has booked
  const seatsBySession: Record<string, number> = {};
  const joinedSessionIds: string[] = [];

  if (sessionIds.length > 0) {
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from("bookings")
      .select("session_id,user_id")
      .in("session_id", sessionIds);

    if (bookingsError) {
      return (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Writing Sessions
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Something went wrong loading bookings.
              </p>
            </div>
          </div>

          <pre className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 text-xs text-zinc-800 overflow-auto">
            {JSON.stringify(bookingsError, null, 2)}
          </pre>
        </div>
      );
    }

    const joinedSet = new Set<string>();
    for (const b of bookings ?? []) {
      seatsBySession[b.session_id] = (seatsBySession[b.session_id] ?? 0) + 1;
      if (userId && b.user_id === userId) joinedSet.add(b.session_id);
    }
    joinedSessionIds.push(...Array.from(joinedSet));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600">
            <span className="inline-flex h-5 items-center rounded-full border border-zinc-200 bg-white/60 px-2">
              Upcoming sessions
            </span>
          </div>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Writing Sessions
          </h1>

          <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
            Pick a session type:{" "}
            <span className="font-semibold text-zinc-900">
              Community ($1, unmoderated)
            </span>{" "}
            or{" "}
            <span className="font-semibold text-zinc-900">
              Pro ($5, moderated)
            </span>
            . Reserve your seat{priceSummary ? ` (${priceSummary})` : ""}.
          </p>

          <p className="mt-2 text-xs text-zinc-500">
            “Join Room” opens <span className="font-semibold">5 minutes</span>{" "}
            before start time (after you reserve your spot).
          </p>
        </div>

        {isAdmin && (
          <Link
            href="/admin/sessions"
            className="shrink-0 rounded-xl border border-zinc-300 bg-white/60 px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-white transition"
          >
            Admin
          </Link>
        )}
      </div>

      {/* Beta note */}
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-5 py-4 text-amber-950 shadow-sm">
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5">
            ⚠️
          </span>
          <p className="text-sm leading-relaxed">
            <span className="font-semibold">Beta Mode — Friends of Rah:</span>{" "}
            Please don&apos;t share this publicly yet. I&apos;m very excited,
            but still working out the kinks (ayo)! Lmk directly if you have
            feedback, questions, etc.
          </p>
        </div>
      </div>

      {/* Browser (filters + list) */}
      <SessionsBrowser
        sessions={typedSessions}
        seatsBySession={seatsBySession}
        joinedSessionIds={joinedSessionIds}
        userId={userId ?? null}
        isAdmin={isAdmin}
      />

      {/* Suggest a time */}
      <div className="rounded-2xl border border-zinc-200/70 bg-white/70 px-6 py-6 text-center shadow-sm">
        <p className="text-sm text-zinc-700">
          No times work for you? Want to host or add a weekly session?
        </p>
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSddb6YHQoTvV11H_y85w4SYG_UhLCXhhJ9FPVF27zTkYJCDbQ/viewform?usp=header"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center mt-4 rounded-xl border border-zinc-300 bg-white/60 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white transition"
        >
          Suggest a time →
        </a>
      </div>
    </div>
  );
}
