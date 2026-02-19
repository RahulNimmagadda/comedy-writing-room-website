import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { joinSession } from "./sessions/actions";
import PayButton from "@/components/PayButton";
import LocalTime from "@/components/LocalTime";
import Link from "next/link";

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

function isJoinWindowOpen(startsAtIso: string, durationMinutes: number) {
  const start = new Date(startsAtIso).getTime();
  const end = start + durationMinutes * 60_000;
  const now = Date.now();

  const openAt = start - 5 * 60_000;
  const closeAt = end + 10 * 60_000;

  return now >= openAt && now <= closeAt;
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

  const seatsBySession = new Map<string, number>();
  const joinedSet = new Set<string>();

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

    for (const b of bookings ?? []) {
      seatsBySession.set(
        b.session_id,
        (seatsBySession.get(b.session_id) ?? 0) + 1
      );
      if (userId && b.user_id === userId) joinedSet.add(b.session_id);
    }
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
            Structured, 60-minute writing rooms for comics. Reserve your seat
            {priceSummary ? ` (${priceSummary})` : ""}.
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

      {/* Sessions list */}
      <div className="space-y-3">
        {typedSessions.map((s) => {
          const seats = seatsBySession.get(s.id) ?? 0;
          const totalCap = s.seat_cap * 5;
          const isFull = seats >= totalCap;

          const alreadyJoined = userId ? joinedSet.has(s.id) : false;
          const canJoinNow = isJoinWindowOpen(s.starts_at, s.duration_minutes);

          const priceLabel =
            Number.isFinite(s.price_cents) && s.price_cents > 0
              ? formatUsd(s.price_cents)
              : "";

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
                  </div>

                  {seats > 5 && (
                    <div className="mt-2 text-xs text-zinc-500">
                      Each room is capped at 5 people. Rooms split automatically
                      as more comics join.
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
                            s.price_cents > 0
                              ? ` (${formatUsd(s.price_cents)})`
                              : ""
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

        {typedSessions.length === 0 && (
          <div className="rounded-2xl border border-zinc-200/70 bg-white/60 p-6 text-sm text-zinc-600">
            No upcoming sessions yet.
          </div>
        )}
      </div>

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
