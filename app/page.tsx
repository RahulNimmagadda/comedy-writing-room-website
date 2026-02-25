export const dynamic = "force-dynamic";
export const revalidate = 0;
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

export default async function HomePage() {
  const { userId } = auth();

  const isAdmin =
    !!userId &&
    (process.env.ADMIN_USER_IDS?.split(",")
      .map((s) => s.trim())
      .includes(userId) ??
      false);

  // ✅ Show upcoming + sessions that started in the last 5 minutes (UTC window)
  const now = Date.now();
  const windowStartIso = new Date(now - 5 * 60_000).toISOString();

  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("sessions")
    .select("id,title,starts_at,duration_minutes,seat_cap,status,price_cents")
    .gte("starts_at", windowStartIso)
    .order("starts_at", { ascending: true });

  if (sessionsError) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Comedy Writing Room
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Something went wrong loading sessions.
            </p>
          </div>
        </div>

        <pre className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4 text-xs text-zinc-800 overflow-auto shadow-sm">
          {JSON.stringify(sessionsError, null, 2)}
        </pre>
      </div>
    );
  }

  const typedSessions = (sessions ?? []) as SessionRow[];
  const sessionIds = typedSessions.map((s) => s.id);

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
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Comedy Writing Room
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Something went wrong loading bookings.
              </p>
            </div>
          </div>

          <pre className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4 text-xs text-zinc-800 overflow-auto shadow-sm">
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
    <div className="mx-auto max-w-3xl space-y-8 sm:space-y-10">
      {/* Hero / Header */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/70 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50/70 via-white/40 to-zinc-50/60" />
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600">
                <span className="inline-flex h-6 items-center rounded-full border border-zinc-200 bg-white/70 px-2.5">
                  Upcoming sessions
                </span>
              </div>

              <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">
                Comedy Writing Room
              </h1>

              <p className="mt-2 text-sm sm:text-base text-zinc-600 leading-relaxed">
                Daily virtual writing rooms for comics. Bring your material,
                workshop, and connect with other comedians around the world!
              </p>
            </div>

            {isAdmin && (
              <Link
                href="/admin/sessions"
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-zinc-300 bg-white/70 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white transition"
              >
                Admin
              </Link>
            )}
          </div>
        </div>
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
          className="inline-flex w-full sm:w-auto items-center justify-center mt-4 rounded-xl border border-zinc-300 bg-white/70 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white transition"
        >
          Suggest a time →
        </a>
      </div>
    </div>
  );
}