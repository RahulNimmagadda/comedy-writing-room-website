// lib/email.ts
type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} env var`);
  return v;
}

function getSiteUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL;

  if (explicit) return explicit.replace(/\/+$/, "");

  // Safe production fallback so email links never point to a Vercel/internal URL
  return "https://comedywritingroom.com";
}

export function siteUrl() {
  return getSiteUrl();
}

export async function sendEmail({ to, subject, html, text }: SendEmailArgs) {
  const apiKey = requireEnv("RESEND_API_KEY");
  const from = requireEnv("EMAIL_FROM");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }

  return res.json().catch(() => ({}));
}

/**
 * Format an ISO timestamp for a specific user timezone.
 * - timezone should be an IANA zone like "America/Mexico_City"
 * - if timezone is missing/invalid, we safely fall back to NYC time
 */
export const DEFAULT_EMAIL_TIMEZONE = "America/New_York";

export function normalizeTimezone(timezone?: string | null) {
  if (!timezone || typeof timezone !== "string") return null;

  const trimmed = timezone.trim();
  if (!trimmed) return null;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    return trimmed;
  } catch {
    return null;
  }
}

export function formatInTimezone(iso: string, timezone?: string | null) {
  const d = new Date(iso);
  const tz = normalizeTimezone(timezone) ?? DEFAULT_EMAIL_TIMEZONE;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

// Backward-compatible helper (kept because other code may import it)
export function formatNYC(iso: string) {
  return formatInTimezone(iso, "America/New_York");
}

export function confirmationEmailHtml(args: {
  sessionTitle: string;
  startsAtIso: string;
  timezone?: string | null;
}) {
  const whenLocal = formatInTimezone(args.startsAtIso, args.timezone);
  const url = siteUrl();

  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5; color:#1f1510;">
    <div style="max-width:560px; border:1px solid #e7d5c1; border-radius:24px; background:#fffaf3; padding:28px;">
    <div style="margin:0 0 8px 0; font-size:12px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:#9a6e4f;">Booking confirmed</div>
    <h2 style="margin:0 0 12px 0; font-size:30px; line-height:1.1;">You’re in</h2>
    <p style="margin:0 0 12px 0; color:#5d4e43;">
      You’re signed up for <strong>${escapeHtml(args.sessionTitle)}</strong>.
    </p>
    <p style="margin:0 0 16px 0;">
      <strong>When:</strong> ${escapeHtml(whenLocal)}
    </p>
    <div style="margin:0 0 18px 0; border:1px solid #ead9c5; border-radius:18px; background:#ffffff; padding:16px;">
      <div style="font-size:11px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:#9a6e4f;">Arrival policy</div>
      <p style="margin:8px 0 0 0; font-size:15px; font-weight:700; color:#2d1d14;">
        Join opens 5 minutes before start and locks 5 minutes after start.
      </p>
      <p style="margin:8px 0 0 0; color:#5d4e43;">
        This session takes place on Zoom, but you’ll enter through the Comedy Writing Room site. We close late entry after 5 minutes so the room can start cleanly without interruptions.
      </p>
    </div>
    <p style="margin:0 0 16px 0; color:#5d4e43;">
      Open the site when the join button appears:
    </p>
    <p style="margin:0 0 20px 0;">
      <a href="${url}" style="display:inline-block; padding:10px 14px; border-radius:10px; background:#111827; color:#fff; text-decoration:none;">
        Open Comedy Writing Room
      </a>
    </p>
    <p style="margin:0; color:#7d6a5d; font-size:12px;">
      Please plan to be there on time so you don’t get locked out once the room gets going.
    </p>
    </div>
  </div>
  `;
}

export function reminderEmailHtml(args: {
  sessionTitle: string;
  startsAtIso: string;
  label: "24h" | "1h";
  timezone?: string | null;
}) {
  const whenLocal = formatInTimezone(args.startsAtIso, args.timezone);
  const url = siteUrl();

  const headline =
    args.label === "24h"
      ? `Reminder ⏰ ${whenLocal}`
      : "Reminder ⏰ Starting soon";

  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5; color:#1f1510;">
    <div style="max-width:560px; border:1px solid #e7d5c1; border-radius:24px; background:#fffaf3; padding:28px;">
    <div style="margin:0 0 8px 0; font-size:12px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:#9a6e4f;">Session reminder</div>
    <h2 style="margin:0 0 12px 0; font-size:30px; line-height:1.1;">${headline}</h2>
    <p style="margin:0 0 12px 0; color:#5d4e43;">
      <strong>${escapeHtml(args.sessionTitle)}</strong>
    </p>
    <p style="margin:0 0 16px 0;">
      <strong>When:</strong> ${escapeHtml(whenLocal)}
    </p>
    <div style="margin:0 0 18px 0; border:1px solid #ead9c5; border-radius:18px; background:#ffffff; padding:16px;">
      <div style="font-size:11px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:#9a6e4f;">Arrival policy</div>
      <p style="margin:8px 0 0 0; font-size:15px; font-weight:700; color:#2d1d14;">
        Join opens 5 minutes before start and locks 5 minutes after start.
      </p>
      <p style="margin:8px 0 0 0; color:#5d4e43;">
        You’ll join through the Comedy Writing Room site, then head into Zoom. Late entry closes after the first 5 minutes so the room can stay focused.
      </p>
    </div>
    <p style="margin:0 0 20px 0;">
      <a href="${url}" style="display:inline-block; padding:10px 14px; border-radius:10px; background:#111827; color:#fff; text-decoration:none;">
        Open Comedy Writing Room
      </a>
    </p>
    <p style="margin:0; color:#7d6a5d; font-size:12px;">
      A couple minutes early is perfect. Once the room is 5 minutes in, the doors close.
    </p>
    </div>
  </div>
  `;
}

// tiny escape helper so titles can't break HTML
function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
