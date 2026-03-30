// app/api/cron/send-reminders/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatInTimezone, reminderEmailHtml, sendEmail } from "@/lib/email";

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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type BookingRow = {
  id: string;
  session_id: string;
  user_email: string | null;
  timezone: string | null;
  created_at: string;
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

function hasValidTimezone(timezone: string | null | undefined) {
  if (!timezone || typeof timezone !== "string") return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function reminderColumn(label: "24h" | "1h") {
  return label === "24h" ? "reminder_24h_sent" : "reminder_1h_sent";
}

async function markReminderSent(bookingId: string, label: "24h" | "1h") {
  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ [reminderColumn(label)]: true })
    .eq("id", bookingId);

  if (error) throw new Error(error.message);
}

function choosePreferredReminder(items: DueItem[]) {
  return items.reduce((best, current) => {
    if (best.label === "24h" && current.label === "1h") return current;
    if (best.label === "1h" && current.label === "24h") return best;

    const bestHasTimezone = hasValidTimezone(best.booking.timezone);
    const currentHasTimezone = hasValidTimezone(current.booking.timezone);

    if (!bestHasTimezone && currentHasTimezone) return current;
    if (bestHasTimezone && !currentHasTimezone) return best;

    const bestCreatedAt = Date.parse(best.booking.created_at);
    const currentCreatedAt = Date.parse(current.booking.created_at);

    if (
      Number.isFinite(bestCreatedAt) &&
      Number.isFinite(currentCreatedAt) &&
      currentCreatedAt > bestCreatedAt
    ) {
      return current;
    }

    return best;
  });
}

async function handler(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  const due: DueItem[] = [];

  const selectCols =
    "id,session_id,user_email,timezone,created_at,reminder_24h_at,reminder_24h_sent,reminder_1h_at,reminder_1h_sent";

  const { data: due24h, error: e24 } = await supabaseAdmin
    .from("bookings")
    .select(selectCols)
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
    .select(selectCols)
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

  const grouped = new Map<string, DueItem[]>();
  for (const item of due) {
    const emailKey = (item.booking.user_email ?? "").trim().toLowerCase();
    const key = `${item.booking.session_id}::${emailKey}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }

  const deduped = Array.from(grouped.entries()).map(([key, items]) => ({
    key,
    primary: choosePreferredReminder(items),
    items,
  }));

  const sessionIds = Array.from(
    new Set(deduped.map((x) => x.primary.booking.session_id))
  );

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

  for (const group of deduped) {
    const item = group.primary;
    const b = item.booking;
    const s = sessionById.get(b.session_id);
    if (!s) continue;

    const startsAtMs = new Date(s.starts_at).getTime();
    const nowMs = now.getTime();

    // Never send if session already started; mark as sent so it won't retry
    if (startsAtMs <= nowMs) {
      skippedLate += group.items.length;
      try {
        for (const groupedItem of group.items) {
          await markReminderSent(groupedItem.booking.id, groupedItem.label);
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

    if (!b.user_email || !isValidEmail(b.user_email)) {
      invalidEmail += 1;
      failures.push({
        bookingId: b.id,
        reason: `Invalid or missing user_email: ${String(b.user_email)}`,
      });
      continue;
    }

    try {
      const whenLocal = formatInTimezone(s.starts_at, b.timezone);
      const subject =
        item.label === "24h"
          ? `Reminder: ${s.title} (${whenLocal})`
          : `Reminder: ${s.title} (starting soon)`;

      await sendEmail({
        to: b.user_email,
        subject,
        html: reminderEmailHtml({
          sessionTitle: s.title,
          startsAtIso: s.starts_at,
          label: item.label,
          timezone: b.timezone,
        }),
      });

      for (const groupedItem of group.items) {
        await markReminderSent(groupedItem.booking.id, groupedItem.label);
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
