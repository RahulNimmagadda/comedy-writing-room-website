"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

const NYC_TZ = "America/New_York";

/**
 * Returns timezone offset (in minutes) for a given UTC Date in the given IANA time zone.
 * Offset is: local_time = utc_time + offset
 * e.g. NYC in winter: offset = -300 (UTC-5)
 */
function getTimeZoneOffsetMinutes(dateUtc: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(dateUtc);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const hh = Number(get("hour"));
  const mm = Number(get("minute"));
  const ss = Number(get("second"));

  // Interpret the "NYC wall clock parts" as if they were UTC.
  // The difference between that and the true UTC instant is the offset.
  const asIfUtcMs = Date.UTC(y, m - 1, d, hh, mm, ss);

  // offset = local(as-utc) - actual(utc)
  return (asIfUtcMs - dateUtc.getTime()) / 60000;
}

/**
 * Input from <input type="datetime-local"> looks like "2026-02-15T12:30"
 * We treat that value as NYC time (America/New_York), regardless of where the admin is.
 * We store starts_at as a UTC ISO string.
 *
 * DST-aware and Node-safe (no Date parsing of locale strings).
 */
function nycInputToIso(local: string) {
  const [datePart, timePart] = local.split("T");
  if (!datePart || !timePart) throw new Error("Invalid date/time.");

  const [yyyyStr, mmStr, ddStr] = datePart.split("-");
  const [hhStr, minStr] = timePart.split(":");

  const yyyy = Number(yyyyStr);
  const month = Number(mmStr);
  const day = Number(ddStr);
  const hour = Number(hhStr);
  const minute = Number(minStr);

  if (
    !Number.isFinite(yyyy) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    throw new Error("Invalid date/time.");
  }

  // Start with a naive UTC guess treating the local time as if it were UTC.
  let utcMs = Date.UTC(yyyy, month - 1, day, hour, minute, 0);

  // Iterate to account for DST boundaries (usually stabilizes in 1-2 passes).
  for (let i = 0; i < 3; i++) {
    const offsetMin = getTimeZoneOffsetMinutes(new Date(utcMs), NYC_TZ);
    const corrected =
      Date.UTC(yyyy, month - 1, day, hour, minute, 0) - offsetMin * 60000;
    if (corrected === utcMs) break;
    utcMs = corrected;
  }

  return new Date(utcMs).toISOString();
}

function parsePriceCents(formData: FormData) {
  const raw = String(formData.get("price_dollars") ?? "").trim();
  const dollars = Number(raw);

  if (!Number.isFinite(dollars) || dollars < 0) {
    throw new Error("Invalid price.");
  }

  // Avoid float weirdness by rounding to nearest cent.
  return Math.round(dollars * 100);
}

async function resolveZoomLinkFromForm(formData: FormData) {
  const zoom_room_number_raw = String(formData.get("zoom_room_number") ?? "")
    .trim()
    .replace(/\s+/g, "");

  const zoom_link_manual = String(formData.get("zoom_link") ?? "").trim();

  // If a room is selected, use its link (authoritative).
  if (zoom_room_number_raw) {
    const roomNumber = Number(zoom_room_number_raw);
    if (!Number.isFinite(roomNumber)) throw new Error("Invalid zoom room.");

    const { data, error } = await supabaseAdmin
      .from("zoom_rooms")
      .select("zoom_link")
      .eq("room_number", roomNumber)
      .single();

    if (error) throw new Error(error.message);
    if (!data?.zoom_link) throw new Error("Zoom room missing zoom_link.");

    return data.zoom_link as string;
  }

  // Otherwise, allow manual link (or blank = null)
  return zoom_link_manual || null;
}

export async function createSession(formData: FormData) {
  requireAdminOrRedirect();

  const title = String(formData.get("title") ?? "").trim();
  const starts_at_local = String(formData.get("starts_at_local") ?? "").trim();
  const duration_minutes = Number(formData.get("duration_minutes"));
  const seat_cap = Number(formData.get("seat_cap"));
  const status = String(formData.get("status") ?? "scheduled").trim();

  if (!title) throw new Error("Title required.");
  if (!starts_at_local) throw new Error("Start time required.");
  if (!Number.isFinite(duration_minutes) || duration_minutes <= 0)
    throw new Error("Invalid duration.");
  if (!Number.isFinite(seat_cap) || seat_cap <= 0)
    throw new Error("Invalid seat cap.");

  const starts_at = nycInputToIso(starts_at_local);
  const price_cents = parsePriceCents(formData);
  const zoom_link = await resolveZoomLinkFromForm(formData);

  const { error } = await supabaseAdmin.from("sessions").insert({
    title,
    starts_at,
    duration_minutes,
    seat_cap,
    status,
    price_cents,
    zoom_link,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/sessions");
  revalidatePath("/admin/sessions");
}

export async function updateSession(formData: FormData) {
  requireAdminOrRedirect();

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const starts_at_local = String(formData.get("starts_at_local") ?? "").trim();
  const duration_minutes = Number(formData.get("duration_minutes"));
  const seat_cap = Number(formData.get("seat_cap"));
  const status = String(formData.get("status") ?? "scheduled").trim();

  if (!id) throw new Error("Missing session id.");
  if (!title) throw new Error("Title required.");
  if (!starts_at_local) throw new Error("Start time required.");
  if (!Number.isFinite(duration_minutes) || duration_minutes <= 0)
    throw new Error("Invalid duration.");
  if (!Number.isFinite(seat_cap) || seat_cap <= 0)
    throw new Error("Invalid seat cap.");

  const starts_at = nycInputToIso(starts_at_local);
  const price_cents = parsePriceCents(formData);
  const zoom_link = await resolveZoomLinkFromForm(formData);

  const { error } = await supabaseAdmin
    .from("sessions")
    .update({
      title,
      starts_at,
      duration_minutes,
      seat_cap,
      status,
      price_cents,
      zoom_link,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/sessions");
  revalidatePath("/admin/sessions");
}

export async function deleteSession(formData: FormData) {
  requireAdminOrRedirect();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing session id.");

  const { error } = await supabaseAdmin.from("sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/sessions");
  revalidatePath("/admin/sessions");
}
