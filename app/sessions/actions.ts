"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { confirmationEmailHtml, sendEmail } from "@/lib/email";

function isAdminUser(userId: string | null) {
  if (!userId) return false;
  const adminIds =
    process.env.ADMIN_USER_IDS?.split(",").map((s) => s.trim()) ?? [];
  return adminIds.includes(userId);
}

function minusHours(iso: string, hours: number) {
  const ms = new Date(iso).getTime() - hours * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

type SessionClaimsWithEmail = {
  email?: unknown;
  primaryEmailAddress?: unknown;
  primary_email?: unknown;
};

function extractEmailFromSessionClaims(sessionClaims: unknown): string | null {
  if (!sessionClaims || typeof sessionClaims !== "object") return null;

  const claims = sessionClaims as SessionClaimsWithEmail;

  const candidates = [claims.email, claims.primaryEmailAddress, claims.primary_email];

  for (const c of candidates) {
    if (typeof c === "string" && c.includes("@")) return c;
  }

  return null;
}

async function getBestEmailForAuthedUser(userId: string) {
  // 1) Try session claims first (fast + no network)
  const { sessionClaims } = auth();
  const claimEmail = extractEmailFromSessionClaims(sessionClaims);
  if (claimEmail) return claimEmail;

  // 2) Fallback to Clerk API
  try {
    const user = await clerkClient.users.getUser(userId);
    return (
      user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses?.[0]?.emailAddress ??
      null
    );
  } catch {
    return null;
  }
}

export async function joinSession(formData: FormData) {
  const { userId } = auth();
  if (!userId) throw new Error("Not signed in");

  // This action is intended to be "Admin: Sign Up Free"
  if (!isAdminUser(userId)) {
    throw new Error("Not authorized");
  }

  const sessionId = String(formData.get("sessionId") || "").trim();
  if (!sessionId) throw new Error("Missing sessionId");

  // 1) Join via DB function (atomic + race-safe)
  const { error } = await supabaseAdmin.rpc("join_session", {
    p_session_id: sessionId,
    p_user_id: userId,
  });

  if (error) throw new Error(error.message);

  // 2) Best email we can get (claims -> Clerk API)
  const email = await getBestEmailForAuthedUser(userId);

  // 3) Fetch session details needed to compute reminder times + email content
  const { data: sessionRow, error: sErr } = await supabaseAdmin
    .from("sessions")
    .select("id,title,starts_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr || !sessionRow) {
    revalidatePath("/");
    return;
  }

  // 4) Find booking row (assumes one booking per user per session; picks most recent)
  const { data: bookingRow, error: bErr } = await supabaseAdmin
    .from("bookings")
    .select("id,confirmation_sent")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bErr || !bookingRow) {
    revalidatePath("/");
    return;
  }

  const reminder24h = minusHours(sessionRow.starts_at, 24);
  const reminder1h = minusHours(sessionRow.starts_at, 1);

  // 5) Update booking (only set email if we have one)
  await supabaseAdmin
    .from("bookings")
    .update({
      ...(email ? { user_email: email } : {}),
      reminder_24h_at: reminder24h,
      reminder_1h_at: reminder1h,
    })
    .eq("id", bookingRow.id);

  // 6) Send confirmation once
  if (email && !bookingRow.confirmation_sent) {
    try {
      await sendEmail({
        to: email,
        subject: `Confirmed: ${sessionRow.title}`,
        html: confirmationEmailHtml({
          sessionTitle: sessionRow.title,
          startsAtIso: sessionRow.starts_at,
        }),
      });

      await supabaseAdmin
        .from("bookings")
        .update({ confirmation_sent: true })
        .eq("id", bookingRow.id);
    } catch {
      // leave confirmation_sent=false for later retry
    }
  }

  revalidatePath("/");
}