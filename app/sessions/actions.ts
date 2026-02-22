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

export async function joinSession(formData: FormData) {
  const { userId } = auth();
  if (!userId) throw new Error("Not signed in");

  // This action is intended to be "Admin: Sign Up Free"
  if (!isAdminUser(userId)) {
    throw new Error("Not authorized");
  }

  const sessionId = String(formData.get("sessionId") || "");
  if (!sessionId) throw new Error("Missing sessionId");

  // 1) Join via DB function (atomic + race-safe)
  const { error } = await supabaseAdmin.rpc("join_session", {
    p_session_id: sessionId,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  // 2) Fetch Clerk email
  let email: string | null = null;
  try {
    const user = await clerkClient.users.getUser(userId);
    email = user.emailAddresses?.find(
      (e) => e.id === user.primaryEmailAddressId
    )?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;
  } catch {
    // ignore; booking can exist without email
  }

  // 3) Fetch session details needed to compute reminder times + email content
  const { data: sessionRow, error: sErr } = await supabaseAdmin
    .from("sessions")
    .select("id,title,starts_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr || !sessionRow) {
    // still consider join successful; just can't enrich
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

  // 5) Update booking with computed fields
  await supabaseAdmin
    .from("bookings")
    .update({
      user_email: email,
      reminder_24h_at: reminder24h,
      reminder_1h_at: reminder1h,
    })
    .eq("id", bookingRow.id);

  // 6) Send confirmation (best-effort, avoid duplicates if already marked)
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
      // leave confirmation_sent=false so we can try again later manually if needed
    }
  }

  revalidatePath("/");
}