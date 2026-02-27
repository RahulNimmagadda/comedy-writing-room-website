import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { joinSession } from "@/app/sessions/actions";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));

  const { id } = await ctx.params;
  return NextResponse.redirect(new URL(`/sessions/${id}`, req.url));
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await ctx.params;

  // Best-effort timezone from client (if available)
  const timezone =
    (req.headers.get("x-timezone") || "").trim() ||
    null;

  // Call the same server action that does the DB join + email stuff
  const fd = new FormData();
  fd.set("sessionId", id);
  if (timezone) fd.set("timezone", timezone);

  const result = await joinSession(fd);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}