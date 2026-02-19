import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Link from "next/link";
import SessionsBrowser from "@/components/SessionsBrowser";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comedy Writing Room",
  description:
    "Daily virtual writing rooms for comics. Bring your material, workshop, and connect with other comedians around the world!",
  openGraph: {
    title: "Comedy Writing Room",
    description:
      "Daily virtual writing rooms for comics. Bring your material, workshop, and connect with other comedians around the world!",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Comedy Writing Room",
    description:
      "Daily virtual writing rooms for comics. Bring your material, workshop, and connect with other comedians around the world!",
  },
};

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
        <h1 className="text-3xl font-semibold tracking-tight">
          Comedy Writing Room
        </h1>
        <p className="text-sm text-zinc-600">
          Something went wrong loading sessions.
        </p>
        <pre className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 text-xs text-zinc-800 overflow-auto">
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
    const { data: bookings } = await supabaseAdmin
      .from("bookings")
      .select("session_id,user_id")
      .in("session_id", sessionIds);

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
            Comedy Writing Room
          </h1>

          <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
            Daily virtual writing rooms for comics. Bring your material,
            workshop, and connect with other comedians around the world!
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

      {/* Browser */}
      <SessionsBrowser
        sessions={typedSessions}
        seatsBySession={seatsBySession}
        joinedSessionIds={joinedSessionIds}
        userId={userId ?? null}
        isAdmin={isAdmin}
      />
    </div>
  );
}
