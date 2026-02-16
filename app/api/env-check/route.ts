import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    urlPreview: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").slice(0, 35),
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    serviceRolePreview: (process.env.SUPABASE_SERVICE_ROLE_KEY || "").slice(0, 12),
  });
}
