"use client";

import SessionActionButton from "@/components/SessionActionButton";
import LocalTime from "@/components/LocalTime";

function formatUsd(cents: number) {
  const safe = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(safe / 100);
}

function sessionType(priceCents: number) {
  if (!Number.isFinite(priceCents)) return "Community";
  return priceCents >= 450 ? "Pro" : "Community";
}

type SessionRow = {
  id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  price_cents: number;
};

function displayDurationMinutes(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 60;
}

export default function FeaturedSessionCard({
  session,
  signupCount,
  userId,
  isJoined,
  isAdmin,
}: {
  session: SessionRow;
  signupCount: number;
  userId?: string | null;
  isJoined?: boolean;
  isAdmin?: boolean;
}) {
  const type = sessionType(session.price_cents);
  const durationMinutes = displayDurationMinutes(session.duration_minutes);
  const signupLabel =
    signupCount === 1 ? "1 comic signed up" : `${signupCount} comics signed up`;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#d8c3ad] bg-[linear-gradient(145deg,#f9f1e7,#eadcca)] p-6 text-[#211610] shadow-[0_26px_70px_rgba(58,36,23,0.18)] sm:p-8">
      <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8c6a50]">
        Next Session
      </div>
      <h2 className="mt-3 font-serif text-4xl font-semibold leading-none text-[#211610] sm:text-5xl">
        {session.title}
      </h2>

      <div className="mt-6 rounded-[1.5rem] border border-[#e2d1bc] bg-white/45 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8c6a50]">
              {type}
            </div>
            <div className="mt-2 text-xl font-semibold text-[#1f1510] sm:text-2xl">
              <LocalTime
                iso={session.starts_at}
                options={{
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }}
              />
            </div>
          </div>

          <div className="font-serif text-3xl font-semibold text-[#3b271c]">
            {formatUsd(session.price_cents)}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#5d4e43]">
          <span>{signupLabel} - more spots available!</span>
          <span className="hidden text-[#b7a28e] sm:inline">•</span>
          <span>{durationMinutes} minutes</span>
        </div>
        <div className="mt-2 rounded-[1.2rem] border border-[#e2d1bc] bg-white/45 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c6a50]">
            Small-group format
          </div>
          <div className="mt-1 text-sm leading-relaxed text-[#5d4e43]">
            Session is split into working groups of 3-4.
          </div>
        </div>
        <div className="mt-3 text-sm leading-relaxed text-[#5d4e43]">
          Bring unfinished ideas and get feedback, steers, and tags from the
          room.
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SessionActionButton
          sessionId={session.id}
          startsAt={session.starts_at}
          durationMinutes={durationMinutes}
          priceCents={session.price_cents}
          userId={userId}
          isJoined={isJoined}
          isAdmin={isAdmin}
          variant="hero"
        />

        <a
          href="#sessions"
          className="inline-flex items-center justify-center rounded-full border border-[#8d735d] bg-white/55 px-5 py-3 text-sm font-semibold text-[#1f1510] transition hover:bg-white/78"
        >
          See All Sessions
        </a>
      </div>
    </section>
  );
}
