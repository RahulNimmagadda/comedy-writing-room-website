import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = auth();
  if (!userId) {
    return new NextResponse("Unauthorized (not signed in)", { status: 401 });
  }

  const sessionId = params.id;

  // 1) Compute room (balanced pre-start; locked at start; late join within 5 min only if fits)
  const { data: roomNumber, error: roomErr } = await supabaseAdmin.rpc(
    "get_room_for_user",
    {
      p_session_id: sessionId,
      p_user_id: userId,
    }
  );

  if (roomErr) {
    // Most common: not booked
    return new NextResponse(roomErr.message, { status: 403 });
  }

  // 2) Fetch the Zoom link for that room
  const { data: zr, error: zrErr } = await supabaseAdmin
    .from("zoom_rooms")
    .select("zoom_link")
    .eq("room_number", roomNumber)
    .maybeSingle();

  if (zrErr) {
    return new NextResponse(`Error loading zoom link: ${zrErr.message}`, {
      status: 500,
    });
  }

  if (!zr?.zoom_link) {
    return new NextResponse(
      `Zoom link not configured for room_number=${roomNumber}`,
      { status: 500 }
    );
  }

  return NextResponse.redirect(zr.zoom_link, { status: 302 });
}
