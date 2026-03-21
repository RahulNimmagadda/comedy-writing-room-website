import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import TimezoneField from "@/components/TimezoneField";

function isJoinWindowOpen(startsAtIso: string, durationMinutes: number) {
  const start = new Date(startsAtIso).getTime();
  const end = start + durationMinutes * 60_000;
  const now = Date.now();

  const openAt = start - 5 * 60_000;
  const closeAt = end + 10 * 60_000;

  return now >= openAt && now <= closeAt;
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const { id: sessionId } = await params;

  // ✅ IMPORTANT: include zoom_link here
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("sessions")
    .select("id, title, starts_at, duration_minutes, zoom_link")
    .eq("id", sessionId)
    .single();

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

  const canJoinNow = isJoinWindowOpen(
    session.starts_at,
    session.duration_minutes
  );

  if (!canJoinNow) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Room not open yet</h1>
        <p className="opacity-70">
          Rooms open 5 minutes before start and close 10 minutes after the session ends.
        </p>
        <Link className="underline" href="/">
          Back to sessions
        </Link>
      </main>
    );
  }

  // Ensure user is booked
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

    const tz = String(formData.get("timezone") || "").trim();

    const { data: b } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!b) redirect(`/sessions/${sessionId}`);

    if (tz) {
      await supabaseAdmin
        .from("bookings")
        .update({ timezone: tz })
        .eq("id", b.id);
    }

    // ✅ NEW: use session-level zoom link
    if (!session.zoom_link) {
      redirect(`/sessions/${sessionId}`);
    }

    redirect(session.zoom_link);
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