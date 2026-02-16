import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", _req.url));

  const { id } = await ctx.params;

  return NextResponse.redirect(new URL(`/sessions/${id}`, _req.url));
}
