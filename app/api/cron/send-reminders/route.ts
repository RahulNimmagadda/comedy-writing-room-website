// app/api/cron/send-reminders/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { reminderEmailHtml, sendEmail } from "@/lib/email";

function getProvidedSecret(req: Request) {
  const x = req.headers.get("x-cron-secret");
  if (x) return x;

  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function isAuthorized(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return getProvidedSecret(req) === expected;
}

function isValidEmail(email: string) {
  // Simple, safe validation for provider APIs (avoid 422 spam)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

type DueItem = {
  booking: BookingRow;
  label: "24h" | "1h";
};

async function handler(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // 1) Pull "due and unsent" bookings in two passes (24h + 1h).
  // We'll dedupe later (1h wins over 24h for the same booking).
  const due: DueItem[] = [];

  const { data: due24h, error: e24 } = await supabaseAdmin
    .from("bookings")
    .select(
      "id,session_id,user_email,reminder_24h_at,reminder_24h_sent,reminder_1h_at,reminder_1h_sent"
    )
    .eq("reminder_24h_sent", false)
    .not("reminder_24h_at", "is", null)
    .lte("reminder_24h_at", nowIso)
    .limit(500);

  if (e24) return NextResponse.json({ error: e24.message }, { status: 500 });

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
    .limit(500);

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  for (const b of (due1h ?? []) as BookingRow[]) {
    due.push({ booking: b, label: "1h" });
  }

  if (due.length === 0) {
    return NextResponse.json({
      ok: true,
      nowIso,
      sent: 0,
      skippedLate: 0,
      invalidEmail: 0,
      failures: [],
    });
  }

  // 2) Dedupe: if both labels are due for the same booking, send 1h only.
  const byBookingId = new Map<string, DueItem>();
  for (const item of due) {
    const existing = byBookingId.get(item.booking.id);
    if (!existing) {
      byBookingId.set(item.booking.id, item);
      continue;
    }
    // Prefer 1h over 24h
    if (existing.label === "24h" && item.label === "1h") {
      byBookingId.set(item.booking.id, item);
    }
  }
  const deduped = Array.from(byBookingId.values());

  // 3) Fetch sessions
  const sessionIds = Array.from(new Set(deduped.map((x) => x.booking.session_id)));

  const { data: sessions, error: sErr } = await supabaseAdmin
    .from("sessions")
    .select("id,title,starts_at")
    .in("id", sessionIds);

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const sessionById = new Map<string, SessionRow>();
  for (const s of (sessions ?? []) as SessionRow[]) sessionById.set(s.id, s);

  let sentCount = 0;
  let skippedLate = 0;
  let invalidEmail = 0;

  const failures: Array<{ bookingId: string; reason: string }> = [];

  for (const item of deduped) {
    const b = item.booking;
    const s = sessionById.get(b.session_id);
    if (!s) continue;

    const startsAt = new Date(s.starts_at).getTime();
    const nowMs = now.getTime();

    // ✅ HARD GUARD: never send reminders for sessions that already started
    if (startsAt <= nowMs) {
      skippedLate += 1;

      // Mark this reminder as "sent" so it doesn't retry tomorrow forever
      try {
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
      } catch (err: unknown) {
        failures.push({
          bookingId: b.id,
          reason:
            "Failed to mark late reminder as sent: " +
            (err instanceof Error ? err.message : String(err)),
        });
      }

      continue;
    }

    // ✅ Validate email before calling provider
    if (!b.user_email || !isValidEmail(b.user_email)) {
      invalidEmail += 1;
      failures.push({
        bookingId: b.id,
        reason: `Invalid or missing user_email: ${String(b.user_email)}`,
      });
      continue;
    }

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

  return NextResponse.json({
    ok: true,
    nowIso,
    candidates: due.length,
    deduped: deduped.length,
    sent: sentCount,
    skippedLate,
    invalidEmail,
    failures,
  });
}

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}