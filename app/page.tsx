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
};

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
    .select("id,title,starts_at,duration_minutes,seat_cap,status")
    .order("starts_at", { ascending: true });

  if (sessionsError) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Upcoming Sessions</h1>
        <pre className="p-4 border rounded overflow-auto bg-white">
          {JSON.stringify(sessionsError, null, 2)}
        </pre>
      </main>
    );
  }

  const typedSessions = (sessions ?? []) as SessionRow[];
  const sessionIds = typedSessions.map((s) => s.id);

  const seatsBySession = new Map<string, number>();
  const joinedSet = new Set<string>();

  if (sessionIds.length > 0) {
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from("bookings")
      .select("session_id,user_id")
      .in("session_id", sessionIds);

    if (bookingsError) {
      return (
        <main className="min-h-screen max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold">Upcoming Sessions</h1>
          <pre className="p-4 border rounded overflow-auto bg-white">
            {JSON.stringify(bookingsError, null, 2)}
          </pre>
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
    <main className="min-h-screen max-w-2xl mx-auto space-y-10">
      <div className="text-center space-y-4 relative">
        {isAdmin && (
          <div className="absolute top-0 right-0">
            <Link
              href="/admin/sessions"
              className="text-sm underline opacity-70 hover:opacity-100"
            >
              Admin
            </Link>
          </div>
        )}

        <h1 className="text-4xl font-bold">Comedy Writing Room</h1>
        <p className="text-lg opacity-80 max-w-2xl mx-auto">
          Daily writing sessions with comics across the globe. Bring material,
          give and get feedback, and sharpen your jokes while meeting other
          comics.
        </p>

        {!userId && (
          <div className="pt-2">
            <Link
              href="/sign-in"
              className="inline-block text-sm underline opacity-80 hover:opacity-100"
            >
              Sign in to reserve spot ($1) →
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
            Please don&apos;t share this publicly yet. I&apos;m very excited, but
            still working out the kinks (ayo)! Lmk directly if you have feedback,
            questions, etc.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Upcoming Sessions</h2>
          <p className="opacity-70 text-sm">
            {userId
              ? "Spots are live."
              : "Browse sessions below. Sign in to reserve a spot ($1)."}
          </p>
          <p className="text-xs opacity-60">
            “Join Room” becomes available 5 minutes before start time (after you
            reserve your spot).
          </p>
        </div>

        <div className="space-y-3">
          {typedSessions.map((s) => {
            const seats = seatsBySession.get(s.id) ?? 0;
            const totalCap = s.seat_cap * 5;
            const isFull = seats >= totalCap;

            const alreadyJoined = userId ? joinedSet.has(s.id) : false;
            const canJoinNow = isJoinWindowOpen(s.starts_at, s.duration_minutes);

            return (
              <div
                key={s.id}
                className="border rounded p-4 flex items-center justify-between gap-4 bg-white"
              >
                <div>
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-sm opacity-70">
                    <LocalTime iso={s.starts_at} /> • {s.duration_minutes} min •{" "}
                    {s.status}
                  </div>

                  <div className="text-sm opacity-70 mt-1">
                    {seats} comics signed up
                  </div>

                  {seats > 5 && (
                    <div className="text-xs opacity-60 mt-1">
                      Each room is capped at 5 people. Rooms split automatically
                      as more comics join.
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {alreadyJoined ? (
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="text-sm px-3 py-2 rounded border bg-gray-50 inline-block">
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

                      <div className="text-xs opacity-60 mt-1">
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
                      {isFull ? "Full" : "Sign in to reserve spot ($1)"}
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
                    <PayButton sessionId={s.id} disabled={isFull} />
                  )}
                </div>
              </div>
            );
          })}

          {typedSessions.length === 0 && (
            <div className="border rounded p-4 opacity-70 bg-white">
              No upcoming sessions yet.
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 p-6 border rounded-lg text-center bg-gray-50">
        <p className="text-sm text-gray-700">
          No times work for you? Want to host or add a weekly session?
        </p>
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSddb6YHQoTvV11H_y85w4SYG_UhLCXhhJ9FPVF27zTkYJCDbQ/viewform?usp=header"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-sm font-semibold underline"
        >
          Suggest a time →
        </a>
      </div>
    </main>
  );
}
