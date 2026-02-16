import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

  // Load session timing info
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("sessions")
    .select("id, title, starts_at, duration_minutes")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Session not found</h1>
        <p className="opacity-70">That session may have been removed.</p>
      </main>
    );
  }

  // Check join window (server-side)
  const canJoinNow = isJoinWindowOpen(session.starts_at, session.duration_minutes);
  if (!canJoinNow) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Room not open yet</h1>
        <p className="opacity-70">
          Rooms open 5 minutes before start and close 10 minutes after the session ends.
        </p>
        <a className="underline" href="/">Back to sessions</a>
      </main>
    );
  }

  // Must be booked (get_room_for_user will also enforce this)
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
        <p className="opacity-70">Please sign up for this session before joining the room.</p>
        <a className="underline" href="/">Back to sessions</a>
      </main>
    );
  }

  // Compute (and possibly persist if session already started) room number
  const { data: roomNumber, error: roomErr } = await supabaseAdmin.rpc(
    "get_room_for_user",
    {
      p_session_id: sessionId,
      p_user_id: userId,
    }
  );

  if (roomErr || !roomNumber) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Couldn’t assign a room</h1>
        <pre className="p-4 border rounded bg-white overflow-auto">
          {JSON.stringify(roomErr ?? { error: "No room number returned" }, null, 2)}
        </pre>
        <a className="underline" href="/">Back to sessions</a>
      </main>
    );
  }

  // Map room number -> Zoom link
  const { data: zoom, error: zoomErr } = await supabaseAdmin
    .from("zoom_rooms")
    .select("zoom_link, room_label")
    .eq("room_number", roomNumber)
    .single();

  if (zoomErr || !zoom?.zoom_link) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Zoom room not configured</h1>
        <p className="opacity-70">
          Room #{roomNumber} doesn’t have a Zoom link set up yet.
        </p>
        <pre className="p-4 border rounded bg-white overflow-auto">
          {JSON.stringify(zoomErr ?? { error: "Missing zoom_link" }, null, 2)}
        </pre>
        <a className="underline" href="/">Back to sessions</a>
      </main>
    );
  }

  // ✅ Send them to Zoom
  redirect(zoom.zoom_link);
}
