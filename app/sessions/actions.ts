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

  const candidates = [
    claims.email,
    claims.primaryEmailAddress,
    claims.primary_email,
  ];

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

export type JoinSessionResult = { ok: true } | { ok: false; error: string };

export async function joinSession(
  formData: FormData
): Promise<JoinSessionResult> {
  try {
    const { userId } = auth();
    if (!userId) return { ok: false, error: "Not signed in" };

    // This action is intended to be "Admin: Sign Up Free"
    if (!isAdminUser(userId)) {
      return { ok: false, error: "Not authorized" };
    }

    const sessionId = String(formData.get("sessionId") || "").trim();
    if (!sessionId) return { ok: false, error: "Missing sessionId" };

    // Validate session exists
    const { data: sessionRow, error: sErr } = await supabaseAdmin
      .from("sessions")
      .select("id,title,starts_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (sErr || !sessionRow) {
      return { ok: false, error: "Session not found" };
    }

    // ✅ Admin is unrestricted: NO time gating here

    // 1) Join via DB function (atomic + race-safe)
    const { error } = await supabaseAdmin.rpc("join_session", {
      p_session_id: sessionId,
      p_user_id: userId,
    });

    if (error) return { ok: false, error: error.message };

    // 2) Best email we can get (claims -> Clerk API)
    const email = await getBestEmailForAuthedUser(userId);

    // 3) Find booking row (assumes one booking per user per session; picks most recent)
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
      return { ok: true };
    }

    // ---- Reminder scheduling guardrails ----
    const nowMs = Date.now();
    const startsAtMs = new Date(sessionRow.starts_at).getTime();

    // If session already started, do NOT create reminders that are immediately due.
    // Also mark reminders as sent so daily/late cron runs never spam.
    const hasStarted = startsAtMs <= nowMs;

    let reminder24hAt: string | null = null;
    let reminder1hAt: string | null = null;

    if (!hasStarted) {
      const r24 = minusHours(sessionRow.starts_at, 24);
      const r1 = minusHours(sessionRow.starts_at, 1);

      const r24Ms = new Date(r24).getTime();
      const r1Ms = new Date(r1).getTime();

      // Only set reminders if they are still in the future.
      // If they're already due, leave null so we don't send "tomorrow" after the fact.
      if (r24Ms > nowMs) reminder24hAt = r24;
      if (r1Ms > nowMs) reminder1hAt = r1;
    }

    // 4) Update booking (only set email if we have one)
    // Also: if session already started, mark reminders as sent to prevent retries.
    await supabaseAdmin
      .from("bookings")
      .update({
        ...(email ? { user_email: email } : {}),
        reminder_24h_at: reminder24hAt,
        reminder_1h_at: reminder1hAt,
        ...(hasStarted
          ? { reminder_24h_sent: true, reminder_1h_sent: true }
          : {}),
      })
      .eq("id", bookingRow.id);

    // 5) Send confirmation once
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
    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong" };
  }
}