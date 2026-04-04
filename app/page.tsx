export const dynamic = "force-dynamic";
export const revalidate = 0;

import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import FeaturedSessionCard from "@/components/FeaturedSessionCard";
import SessionsBrowser from "@/components/SessionsBrowser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SessionRow = {
  id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  seat_cap: number;
  status: string;
  price_cents: number;
};

export default async function HomePage() {
  const { userId } = await auth();

  const isAdmin =
    !!userId &&
    (process.env.ADMIN_USER_IDS?.split(",")
      .map((s) => s.trim())
      .includes(userId) ??
      false);

  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("sessions")
    .select("id,title,starts_at,duration_minutes,seat_cap,status,price_cents")
    .eq("status", "scheduled")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (sessionsError) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              Comedy Writing Room
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Something went wrong loading sessions.
            </p>
          </div>
        </div>

        <pre className="overflow-auto rounded-2xl border border-zinc-200/70 bg-white/80 p-4 text-xs text-zinc-800 shadow-sm">
          {JSON.stringify(sessionsError, null, 2)}
        </pre>
      </div>
    );
  }

  const typedSessions = (sessions ?? []) as SessionRow[];
  const sessionIds = typedSessions.map((s) => s.id);

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
              <h1 className="font-serif text-3xl font-semibold tracking-tight">
                Comedy Writing Room
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Something went wrong loading bookings.
              </p>
            </div>
          </div>

          <pre className="overflow-auto rounded-2xl border border-zinc-200/70 bg-white/80 p-4 text-xs text-zinc-800 shadow-sm">
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

  const featuredSession = typedSessions[0] ?? null;
  const featuredSignupCount = featuredSession
    ? seatsBySession[featuredSession.id] ?? 0
    : 0;
  const featuredJoined = featuredSession
    ? joinedSessionIds.includes(featuredSession.id)
    : false;

  return (
    <div className="space-y-12 pb-8 sm:space-y-16">
      <section className="relative overflow-hidden rounded-[2.75rem] border border-[#4f3729] bg-[radial-gradient(circle_at_75%_28%,rgba(240,194,122,0.14),transparent_0,transparent_24%),linear-gradient(135deg,#19120d_0%,#261913_45%,#3b271c_100%)] px-6 py-10 text-[#f8f1e8] shadow-[0_28px_90px_rgba(45,28,18,0.24)] sm:px-10 sm:py-12 lg:px-14 lg:py-16">
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(circle_at_bottom,rgba(201,85,46,0.12),transparent_58%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-10">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#f0d2a8]">
              Virtual Writing Rooms for Comics
            </div>
            <h1 className="mt-5 max-w-4xl font-serif text-6xl font-semibold leading-[0.92] tracking-tight text-[#f8f1e8] sm:text-7xl lg:text-[6.9rem]">
              Sharpen bits with other funny people.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#d4c3b3] sm:text-xl">
              Bring your premises, half-written tags, or the bit that still is
              not landing. Leave with sharper jokes, clear notes, and a room
              full of comics who get it.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#sessions"
                className="inline-flex items-center justify-center rounded-full bg-[#f3e4cf] px-6 py-3 text-sm font-semibold text-[#1f1510] shadow-[0_12px_30px_rgba(13,8,4,0.18)] transition hover:bg-[#fff3e0]"
              >
                Book a Session
              </a>
              <Link
                href="/#how-it-works"
                className="inline-flex items-center justify-center rounded-full border border-[#8d735d] px-6 py-3 text-sm font-semibold text-[#f7eedf] transition hover:bg-white/5"
              >
                How It Works
              </Link>
              {isAdmin && (
                <Link
                  href="/admin/sessions"
                  className="inline-flex items-center justify-center rounded-full border border-[#8d735d] px-6 py-3 text-sm font-semibold text-[#f7eedf] transition hover:bg-white/5"
                >
                  Admin
                </Link>
              )}
            </div>

            <div className="mt-10 grid gap-4 text-[#f5eadb] sm:grid-cols-3">
              <div>
                <div className="text-sm text-[#a99585]">Session length</div>
                <div className="font-serif text-3xl font-semibold">
                  60 minutes
                </div>
              </div>
              <div>
                <div className="text-sm text-[#a99585]">Room format</div>
                <div className="font-serif text-3xl font-semibold">
                  3-4 comics per breakout
                </div>
                <div className="mt-1 max-w-[16rem] text-sm leading-relaxed text-[#a99585]">
                  Even if 100 comics sign up for a session, you&apos;ll be put
                  into small groups of 3-4.
                </div>
              </div>
              <div>
                <div className="text-sm text-[#a99585]">Pricing</div>
                <div className="font-serif text-3xl font-semibold leading-none">
                  <div>$1 community /</div>
                  <div className="mt-1">$5 pro</div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:pt-4">
            {featuredSession ? (
              <FeaturedSessionCard
                session={featuredSession}
                signupCount={featuredSignupCount}
                userId={userId ?? null}
                isJoined={featuredJoined}
                isAdmin={isAdmin}
              />
            ) : (
              <div className="rounded-[2rem] border border-[#5b4031] bg-[#f7efe4]/10 p-8 shadow-[0_26px_70px_rgba(26,18,13,0.18)]">
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f0d2a8]">
                  Next Session
                </div>
                <h2 className="mt-3 font-serif text-4xl font-semibold text-[#f8f1e8]">
                  No upcoming rooms right now
                </h2>
                <p className="mt-4 text-base leading-relaxed text-[#d4c3b3]">
                  Check back soon, or suggest a time that would make the room
                  work better for you.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="space-y-6 scroll-mt-28">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#8c6a50]">
            How It Works
          </div>
          <h2 className="mt-3 font-serif text-5xl font-semibold tracking-tight text-[#1d140f] sm:text-6xl">
            A clean, useful room format.
          </h2>
          <p className="mt-3 max-w-3xl text-lg text-[#5e5045]">
            No fluff. No rambling. Just enough structure to help comics
            actually make progress.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {[
            {
              step: "01",
              title: "Quick intros",
              body: "Meet the room, say what you are working on, and get straight into the material.",
            },
            {
              step: "02",
              title: "Run your bits",
              body: "Each person gets 12-15 minutes to share material and get feedback, steers, and tags. Rooms stay at 3-4 comics, and bigger signups split into breakout groups.",
            },
            {
              step: "03",
              title: "Leave with notes",
              body: "Feedback stays specific, respectful, and focused on finding the stronger version of the joke.",
            },
          ].map((item) => (
            <article
              key={item.step}
              className="rounded-[2rem] border border-[#d8c3ad] bg-[#fbf5eb]/88 p-6 shadow-[0_24px_60px_rgba(58,36,23,0.08)]"
            >
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#b5532e]">
                {item.step}
              </div>
              <h3 className="mt-5 font-serif text-4xl font-semibold text-[#1d140f]">
                {item.title}
              </h3>
              <p className="mt-4 text-base leading-relaxed text-[#5e5045]">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[2.25rem] bg-[linear-gradient(135deg,#201611_0%,#2e1e16_100%)] px-7 py-9 text-[#f8f1e8] shadow-[0_28px_90px_rgba(45,28,18,0.18)] sm:px-10">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#f1c27b]">
          Why People Come Back
        </div>
        <h2 className="mt-4 max-w-4xl font-serif text-5xl font-semibold tracking-tight sm:text-6xl">
          Consistent reps. Better jokes. Real community.
        </h2>
        <p className="mt-5 max-w-4xl text-lg leading-relaxed text-[#d4c3b3]">
          Comedy gets easier when you stop writing alone. The room gives you
          momentum, accountability, and stronger material. As a bonus, you get
          comedy connections and perspective from different cities and
          countries!
        </p>
      </section>

      <section id="sessions" className="space-y-5 scroll-mt-28">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#8c6a50]">
            Upcoming Sessions
          </div>
          <h2 className="mt-3 font-serif text-5xl font-semibold tracking-tight text-[#1d140f] sm:text-6xl">
            Find a room that fits your schedule.
          </h2>
        </div>

        <SessionsBrowser
          sessions={typedSessions}
          seatsBySession={seatsBySession}
          joinedSessionIds={joinedSessionIds}
          userId={userId ?? null}
          isAdmin={isAdmin}
        />
      </section>

      <div className="rounded-[2rem] border border-[#deccb8] bg-[#f9f2e8]/72 px-6 py-6 shadow-[0_16px_36px_rgba(58,36,23,0.05)] sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c6a50]">
            Community Input
          </div>
          <p className="mt-2 font-serif text-3xl font-semibold text-[#1d140f] sm:text-[2rem]">
            No time that works for you?
          </p>
          <p className="mt-2 text-base leading-relaxed text-[#5e5045]">
            Suggest a time, ask about hosting, or send feedback. This is being
            built with the community.
          </p>
        </div>
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSddb6YHQoTvV11H_y85w4SYG_UhLCXhhJ9FPVF27zTkYJCDbQ/viewform?usp=header"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center justify-center rounded-full border border-[#bea58e] bg-[#fff9f1]/78 px-5 py-3 text-sm font-semibold text-[#3b271c] transition hover:bg-[#fffdf8] sm:mt-0"
        >
          Suggest a Time
        </a>
      </div>
    </div>
  );
}
