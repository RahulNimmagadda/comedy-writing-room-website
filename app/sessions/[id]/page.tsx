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
          Rooms open 5 minutes before start and close 10 minutes after the
          session ends.
        </p>
        <Link className="underline" href="/">
          Back to sessions
        </Link>
      </main>
    );
  }

  // Ensure user is booked
  const { data: booking, error: bookingErr } = await supabaseAdmin
    .from("bookings")
    .select("id, timezone")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (bookingErr) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <pre className="p-4 border rounded bg-white overflow-auto">
          {JSON.stringify(bookingErr, null, 2)}
        </pre>
        <Link className="underline" href="/">
          Back to sessions
        </Link>
      </main>
    );
  }

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

  /**
   * We capture timezone on the client and POST it back to this same route.
   * Then we update the booking timezone and redirect the user into the room.
   */
  async function joinNow(formData: FormData) {
    "use server";

    const tz = String(formData.get("timezone") || "").trim();
    if (tz) {
      // Best-effort: store timezone for future emails
      await supabaseAdmin
        .from("bookings")
        .update({ timezone: tz })
        .eq("id", booking.id);
    }

    // ✅ NEW: If the session has a zoom_link override, use it (single-room mode)
    if (session.zoom_link && session.zoom_link.trim().length > 0) {
      redirect(session.zoom_link.trim());
    }

    // Otherwise keep existing multi-room split behavior
    const { data: roomNumber, error: roomErr } = await supabaseAdmin.rpc(
      "get_room_for_user",
      {
        p_session_id: sessionId,
        p_user_id: userId,
      }
    );

    if (roomErr || !roomNumber) {
      // If room assignment fails, bounce back with a readable error
      redirect(`/sessions/${sessionId}/join?error=room_assignment_failed`);
    }

    const { data: zoom, error: zoomErr } = await supabaseAdmin
      .from("zoom_rooms")
      .select("zoom_link, room_label")
      .eq("room_number", roomNumber)
      .single();

    if (zoomErr || !zoom?.zoom_link) {
      redirect(`/sessions/${sessionId}/join?error=zoom_not_configured`);
    }

    redirect(zoom.zoom_link);
  }

  // If there is an error query param, show a nicer message
  // (we keep it lightweight; your existing error blocks are still fine)
  // Note: Next app router doesn't give searchParams here unless included;
  // so we won't overcomplicate.

  return (
    <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-bold">Join room</h1>
      <p className="opacity-70">
        You’re signed up. Click below to enter your Zoom room.
      </p>

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