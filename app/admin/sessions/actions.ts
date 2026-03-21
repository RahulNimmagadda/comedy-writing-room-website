"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const NYC_TZ = "America/New_York";

function requireAdminOrRedirect() {
  const { userId } = auth();
  if (!userId) redirect("/");

  const allowlist = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!allowlist.includes(userId)) redirect("/");
  return userId;
}

function parseIntSafe(v: FormDataEntryValue | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function parseFloatSafe(v: FormDataEntryValue | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function dollarsToCents(dollars: number) {
  const safe = Number.isFinite(dollars) ? dollars : 0;
  return Math.max(0, Math.round(safe * 100));
}

function nycLocalToUtcIso(local: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error("Invalid starts_at_local format.");

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);

  const intendedMinutes = (((year * 12 + month) * 32 + day) * 24 + hour) * 60 + minute;

  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: NYC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const getParts = (ms: number) => {
    const parts = fmt.formatToParts(new Date(ms));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return {
      y: Number(get("year")),
      mo: Number(get("month")),
      d: Number(get("day")),
      h: Number(get("hour")),
      mi: Number(get("minute")),
    };
  };

  for (let i = 0; i < 4; i++) {
    const p = getParts(utcMs);
    const gotMinutes = (((p.y * 12 + p.mo) * 32 + p.d) * 24 + p.h) * 60 + p.mi;
    const delta = intendedMinutes - gotMinutes;
    if (delta === 0) break;
    utcMs += delta * 60_000;
  }

  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date/time.");
  return d.toISOString();
}

function addDaysUtcIso(utcIso: string, days: number) {
  const d = new Date(utcIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/**
 * 🔥 CREATE SESSION (ENFORCES ZOOM LINK)
 */
export async function createSession(formData: FormData) {
  requireAdminOrRedirect();

  const title = String(formData.get("title") ?? "").trim();
  const startsAtLocal = String(formData.get("starts_at_local") ?? "").trim();
  const durationMinutes = parseIntSafe(formData.get("duration_minutes"), 60);
  const seatCap = parseIntSafe(formData.get("seat_cap"), 5);
  const status = String(formData.get("status") ?? "scheduled").trim();

  const priceDollars = parseFloatSafe(formData.get("price_dollars"), 0);
  const priceCents = dollarsToCents(priceDollars);

  const repeatWeeks = Math.max(0, parseIntSafe(formData.get("repeat_weeks"), 0));

  const zoomLink = String(formData.get("zoom_link") ?? "").trim();

  if (!title) throw new Error("Title is required.");
  if (!startsAtLocal) throw new Error("Start time is required.");
  if (!zoomLink) throw new Error("Zoom link is required.");

  const startsAtUtcIso = nycLocalToUtcIso(startsAtLocal);

  const rows = [];
  for (let i = 0; i <= repeatWeeks; i++) {
    rows.push({
      title,
      starts_at: addDaysUtcIso(startsAtUtcIso, i * 7),
      duration_minutes: durationMinutes,
      seat_cap: seatCap,
      status,
      zoom_link: zoomLink,
      price_cents: priceCents,
    });
  }

  const { error } = await supabaseAdmin.from("sessions").insert(rows);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin/sessions");
}

/**
 * 🔥 UPDATE SESSION (ENFORCES ZOOM LINK)
 */
export async function updateSession(formData: FormData) {
  requireAdminOrRedirect();

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const startsAtLocal = String(formData.get("starts_at_local") ?? "").trim();
  const durationMinutes = parseIntSafe(formData.get("duration_minutes"), 60);
  const seatCap = parseIntSafe(formData.get("seat_cap"), 5);
  const status = String(formData.get("status") ?? "scheduled").trim();

  const priceDollars = parseFloatSafe(formData.get("price_dollars"), 0);
  const priceCents = dollarsToCents(priceDollars);

  const zoomLink = String(formData.get("zoom_link") ?? "").trim();

  if (!id) throw new Error("Missing session id.");
  if (!title) throw new Error("Title is required.");
  if (!startsAtLocal) throw new Error("Start time is required.");
  if (!zoomLink) throw new Error("Zoom link is required.");

  const startsAtUtcIso = nycLocalToUtcIso(startsAtLocal);

  const { error } = await supabaseAdmin
    .from("sessions")
    .update({
      title,
      starts_at: startsAtUtcIso,
      duration_minutes: durationMinutes,
      seat_cap: seatCap,
      status,
      zoom_link: zoomLink,
      price_cents: priceCents,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin/sessions");
}

export async function deleteSession(formData: FormData) {
  requireAdminOrRedirect();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing session id.");

  const { error } = await supabaseAdmin.from("sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin/sessions");
}