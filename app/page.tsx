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
      <main className="min-h-screen bg-black text-white px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-2xl font-bold">Upcoming Sessions</h1>
          <pre className="p-4 border border-white/15 rounded overflow-auto bg-white text-gray-900">
            {JSON.stringify(sessionsError, null, 2)}
          </pre>
        </div>
      </main>
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
        <main className="min-h-screen bg-black text-white px-4 py-10">
          <div className="mx-auto max-w-2xl space-y-6">
            <h1 className="text-2xl font-bold">Upcoming Sessions</h1>
            <pre className="p-4 border border-white/15 rounded overflow-auto bg-white text-gray-900">
              {JSON.stringify(bookingsError, null, 2)}
            </pre>
          </div>
        </main>
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
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-2xl space-y-10 px-4 py-10 sm:px-6">
        {/* Hero */}
        <div className="text-center space-y-4 relative">
          {isAdmin && (
            <div className="absolute top-0 right-0">
              <Link
                href="/admin/sessions"
                className="text-sm underline text-white/70 hover:text-white"
              >
                Admin
              </Link>
            </div>
          )}

          <h1 className="text-4xl font-bold sm:text-5xl">
            Comedy Writing Room
          </h1>

          <p className="text-base sm:text-lg text-white/70 max-w-prose mx-auto">
            Daily writing sessions with comics across the globe. Bring material,
            give and get feedback, and sharpen your jokes while meeting other
            comics.
          </p>

          {!userId && (
            <div className="pt-2">
              <Link
                href="/sign-in"
                className="inline-block text-sm underline text-white/80 hover:text-white"
              >
                Sign in to reserve spot{priceSummary ? ` (${priceSummary})` : ""}{" "}
                →
              </Link>
            </div>
          )}
        </div>

        {/* Beta banner */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <div className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5">
              ⚠️
            </span>
            <p className="text-sm leading-relaxed">
              <span className="font-semibold">Beta Mode - Friends of Rah:</span>{" "}
              Please don&apos;t share this publicly yet. I&apos;m very excited,
              but still working out the kinks (ayo)! Lmk directly if you have
              feedback, questions, etc.
            </p>
          </div>
        </div>

        {/* Upcoming sessions */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Upcoming Sessions</h2>
            <p className="text-sm text-white/70">
              {userId
                ? "Spots are live."
                : `Browse sessions below. Sign in to reserve a spot${
                    priceSummary ? ` (${priceSummary})` : ""
                  }.`}
            </p>
            <p className="text-xs text-white/60">
              “Join Room” becomes available 5 minutes before start time (after
              you reserve your spot).
            </p>
          </div>

          <div className="space-y-3">
            {typedSessions.map((s) => {
              const seats = seatsBySession.get(s.id) ?? 0;
              const totalCap = s.seat_cap * 5;
              const isFull = seats >= totalCap;

              const alreadyJoined = userId ? joinedSet.has(s.id) : false;
              const canJoinNow = isJoinWindowOpen(
                s.starts_at,
                s.duration_minutes
              );

              return (
                <div
                  key={s.id}
                  className="border border-gray-200 rounded-2xl p-4 flex items-center justify-between gap-4 bg-white text-gray-900 shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {s.title}
                    </div>

                    <div className="text-sm text-gray-600">
                      <LocalTime iso={s.starts_at} /> • {s.duration_minutes} min •{" "}
                      {s.status}
                      {Number.isFinite(s.price_cents) && s.price_cents > 0
                        ? ` • ${formatUsd(s.price_cents)}`
                        : ""}
                    </div>

                    <div className="text-sm text-gray-600 mt-1">
                      {seats} comics signed up
                    </div>

                    {seats > 5 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Each room is capped at 5 people. Rooms split automatically
                        as more comics join.
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {alreadyJoined ? (
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="text-sm px-3 py-2 rounded border border-gray-200 bg-gray-50 inline-block text-gray-900">
                            Reserved ✅
                          </div>

                          <Link
                            href={`/sessions/${s.id}/join`}
                            className={`px-3 py-2 rounded text-white ${
                              canJoinNow
                                ? "bg-black"
                                : "bg-black opacity-40 pointer-events-none"
                            }`}
                          >
                            Join Room
                          </Link>
                        </div>

                        <div className="text-xs text-gray-500 mt-1">
                          {canJoinNow
                            ? "Room is open — join now"
                            : "Room opens 5 minutes before start"}
                        </div>
                      </div>
                    ) : !userId ? (
                      <Link
                        href={`/sign-in?redirect_url=${encodeURIComponent("/")}`}
                        className={`px-3 py-2 rounded text-white ${
                          isFull ? "bg-black opacity-40 pointer-events-none" : "bg-black"
                        }`}
                      >
                        {isFull
                          ? "Full"
                          : `Sign in to reserve spot${
                              s.price_cents > 0 ? ` (${formatUsd(s.price_cents)})` : ""
                            }`}
                      </Link>
                    ) : isAdmin ? (
                      <form action={joinSession}>
                        <input type="hidden" name="sessionId" value={s.id} />
                        <button
                          className="px-3 py-2 rounded bg-black text-white disabled:opacity-40"
                          disabled={isFull}
                        >
                          {isFull ? "Full" : "Admin: Reserve Free"}
                        </button>
                      </form>
                    ) : (
                      <PayButton
                        sessionId={s.id}
                        priceCents={s.price_cents}
                        disabled={isFull}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {typedSessions.length === 0 && (
              <div className="border border-white/15 rounded-2xl p-4 text-white/70 bg-black">
                No upcoming sessions yet.
              </div>
            )}
          </div>
        </div>

        {/* Suggest a time */}
        <div className="mt-12 p-6 border border-white/15 rounded-2xl text-center bg-white text-gray-900">
          <p className="text-sm text-gray-700">
            No times work for you? Want to host or add a weekly session?
          </p>
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSddb6YHQoTvV11H_y85w4SYG_UhLCXhhJ9FPVF27zTkYJCDbQ/viewform?usp=header"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-sm font-semibold underline text-gray-900"
          >
            Suggest a time →
          </a>
        </div>
      </div>
    </main>
  );
}
