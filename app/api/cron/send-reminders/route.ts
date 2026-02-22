// app/api/cron/send-reminders/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { reminderEmailHtml, sendEmail } from "@/lib/email";

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization") || "";
  // Expect: Authorization: Bearer <CRON_SECRET>
  return auth === `Bearer ${secret}`;
}

type BookingRow = {
  id: string;
  session_id: string;
  user_email: string | null;
  reminder_24h_at: string | null;
  reminder_24h_sent: boolean;
  reminder_1h_at: string | null;
  reminder_1h_sent: boolean;
};

type SessionRow = {
  id: string;
  title: string;
  starts_at: string; // UTC ISO
};

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();

  // Pull "due and unsent" bookings in two passes (24h + 1h).
  // We keep the query simple and then fetch session details by ids.
  const due: Array<{ booking: BookingRow; label: "24h" | "1h" }> = [];

  const { data: due24h, error: e24 } = await supabaseAdmin
    .from("bookings")
    .select(
      "id,session_id,user_email,reminder_24h_at,reminder_24h_sent,reminder_1h_at,reminder_1h_sent"
    )
    .eq("reminder_24h_sent", false)
    .not("reminder_24h_at", "is", null)
    .lte("reminder_24h_at", nowIso)
    .limit(200);

  if (e24) {
    return NextResponse.json({ error: e24.message }, { status: 500 });
  }

  for (const b of (due24h ?? []) as BookingRow[]) {
    due.push({ booking: b, label: "24h" });
  }

  const { data: due1h, error: e1 } = await supabaseAdmin
    .from("bookings")
    .select(
      "id,session_id,user_email,reminder_24h_at,reminder_24h_sent,reminder_1h_at,reminder_1h_sent"
    )
    .eq("reminder_1h_sent", false)
    .not("reminder_1h_at", "is", null)
    .lte("reminder_1h_at", nowIso)
    .limit(200);

  if (e1) {
    return NextResponse.json({ error: e1.message }, { status: 500 });
  }

  for (const b of (due1h ?? []) as BookingRow[]) {
    due.push({ booking: b, label: "1h" });
  }

  // Nothing to do
  if (due.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const sessionIds = Array.from(new Set(due.map((x) => x.booking.session_id)));

  const { data: sessions, error: sErr } = await supabaseAdmin
    .from("sessions")
    .select("id,title,starts_at")
    .in("id", sessionIds);

  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  const sessionById = new Map<string, SessionRow>();
  for (const s of (sessions ?? []) as SessionRow[]) sessionById.set(s.id, s);

  let sentCount = 0;
  const failures: Array<{ bookingId: string; reason: string }> = [];

  for (const item of due) {
    const b = item.booking;
    if (!b.user_email) continue; // can't send

    const s = sessionById.get(b.session_id);
    if (!s) continue;

    try {
      const subject =
        item.label === "24h"
          ? `Reminder: ${s.title} (tomorrow)`
          : `Reminder: ${s.title} (starting soon)`;

      await sendEmail({
        to: b.user_email,
        subject,
        html: reminderEmailHtml({
          sessionTitle: s.title,
          startsAtIso: s.starts_at,
          label: item.label,
        }),
      });

      // Mark sent after successful send
      if (item.label === "24h") {
        const { error: upErr } = await supabaseAdmin
          .from("bookings")
          .update({ reminder_24h_sent: true })
          .eq("id", b.id);

        if (upErr) throw new Error(upErr.message);
      } else {
        const { error: upErr } = await supabaseAdmin
          .from("bookings")
          .update({ reminder_1h_sent: true })
          .eq("id", b.id);

        if (upErr) throw new Error(upErr.message);
      }

      sentCount += 1;
    } catch (err: unknown) {
      failures.push({
        bookingId: b.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, sent: sentCount, failures });
}