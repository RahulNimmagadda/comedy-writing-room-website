import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import TimezoneField from "@/components/TimezoneField";
import JoinRoomGate from "@/components/JoinRoomGate";

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

function getSessionZoomLink(zoomLink: string | null) {
  const manual = String(zoomLink ?? "").trim();
  const fallback = String(process.env.DEFAULT_ZOOM_LINK ?? "").trim();
  return manual || fallback || null;
}

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
  const sessionZoomLink = getSessionZoomLink(session.zoom_link);

  if (!sessionZoomLink) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Join link not ready yet</h1>
        <p className="opacity-70">
          You&apos;re signed up, but the Zoom link has not been added for this
          session yet. Please check back shortly or reach out if it stays this
          way close to start time.
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

    const { data: b } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!b) {
      redirect(`/sessions/${sessionId}/join`);
    }

    const { joinOpensAt, reserveClosesAt, end } = getSessionTiming(
      currentSession.starts_at,
      currentSession.duration_minutes
    );
    const now = Date.now();

    if (now < joinOpensAt || now > reserveClosesAt || now > end) {
      redirect(`/sessions/${sessionId}/join`);
    }

    const tz = String(formData.get("timezone") || "").trim();

    if (tz) {
      await supabaseAdmin
        .from("bookings")
        .update({ timezone: tz })
        .eq("id", b.id);
    }

    const currentSessionZoomLink = getSessionZoomLink(currentSession.zoom_link);

    if (!currentSessionZoomLink) {
      redirect(`/sessions/${sessionId}/join`);
    }

    redirect(currentSessionZoomLink);
  }

  return (
    <JoinRoomGate
      title={session.title}
      startsAt={session.starts_at}
      durationMinutes={session.duration_minutes}
    >
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
    </JoinRoomGate>
  );
}
