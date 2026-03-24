import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import TimezoneField from "@/components/TimezoneField";

function getSessionTiming(startsAtIso: string, durationMinutes: number) {
  const start = new Date(startsAtIso).getTime();
  const end = start + durationMinutes * 60_000;

  return {
    start,
    end,
    joinOpensAt: start - 5 * 60_000,
    reserveClosesAt: start + 5 * 60_000,
  };
}

type SessionRow = {
  id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  zoom_link: string | null;
};

export default async function SessionJoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const { id: sessionId } = await params;

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("sessions")
    .select("id, title, starts_at, duration_minutes, zoom_link")
    .eq("id", sessionId)
    .single<SessionRow>();

  if (sessionError || !session) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Session not found</h1>
        <p className="opacity-70">That session may have been removed.</p>
        <Link className="underline" href="/">
          Back to sessions
        </Link>
      </main>
    );
  }

  const { end, joinOpensAt, reserveClosesAt } = getSessionTiming(
    session.starts_at,
    session.duration_minutes
  );
  const now = Date.now();

  if (now > end) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Session Ended</h1>
        <p className="opacity-70">This session has already ended.</p>
        <Link className="underline" href="/">
          Back to sessions
        </Link>
      </main>
    );
  }

  if (now < joinOpensAt) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Room not open yet</h1>
        <p className="opacity-70">
          Rooms open 5 minutes before the session starts.
        </p>
        <Link className="underline" href="/">
          Back to sessions
        </Link>
      </main>
    );
  }

  if (now > reserveClosesAt) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Session in progress</h1>
        <p className="opacity-70">
          Joining from the session page is only available until 5 minutes after
          the session starts.
        </p>
        <Link className="underline" href="/">
          Back to sessions
        </Link>
      </main>
    );
  }

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!booking) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">You’re not signed up</h1>
        <p className="opacity-70">
          Please sign up for this session before joining the room.
        </p>
        <Link className="underline" href="/">
          Back to sessions
        </Link>
      </main>
    );
  }

  async function joinNow(formData: FormData) {
    "use server";

    const { userId } = auth();
    if (!userId) redirect("/sign-in");

    const { data: currentSession } = await supabaseAdmin
      .from("sessions")
      .select("id, starts_at, duration_minutes, zoom_link")
      .eq("id", sessionId)
      .single<{
        id: string;
        starts_at: string;
        duration_minutes: number;
        zoom_link: string | null;
      }>();

    if (!currentSession) {
      redirect("/");
    }

    const { joinOpensAt, reserveClosesAt, end } = getSessionTiming(
      currentSession.starts_at,
      currentSession.duration_minutes
    );
    const now = Date.now();

    if (now < joinOpensAt || now > reserveClosesAt || now > end) {
      redirect(`/sessions/${sessionId}/join`);
    }

    const { data: b } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!b) {
      redirect(`/sessions/${sessionId}/join`);
    }

    const tz = String(formData.get("timezone") || "").trim();

    if (tz) {
      await supabaseAdmin
        .from("bookings")
        .update({ timezone: tz })
        .eq("id", b.id);
    }

    if (!currentSession.zoom_link) {
      redirect(`/sessions/${sessionId}/join`);
    }

    redirect(currentSession.zoom_link);
  }

  return (
    <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-bold">{session.title}</h1>
      <p className="opacity-70">Click below to join the room.</p>

      <form action={joinNow} className="space-y-3">
        <TimezoneField />
        <button className="px-4 py-2 rounded-xl bg-black text-white font-semibold">
          Join now →
        </button>
      </form>

      <Link className="underline" href="/">
        Back to sessions
      </Link>
    </main>
  );
}