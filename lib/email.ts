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
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`.replace(/\/+$/, "");

  // last-resort fallback (local dev)
  return "http://localhost:3000";
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
 * - if timezone is missing/invalid, we safely fall back to UTC
 */
export function formatInTimezone(iso: string, timezone?: string | null) {
  const d = new Date(iso);
  const tz = timezone && typeof timezone === "string" && timezone.length > 0 ? timezone : "UTC";

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    // If timezone is invalid, fall back to UTC
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  }
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
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5;">
    <h2 style="margin:0 0 12px 0;">You’re in ✅</h2>
    <p style="margin:0 0 12px 0;">
      You’re signed up for <strong>${escapeHtml(args.sessionTitle)}</strong>.
    </p>
    <p style="margin:0 0 16px 0;">
      <strong>When:</strong> ${escapeHtml(whenLocal)}
    </p>
    <p style="margin:0 0 16px 0;">
      Join from the site when the button opens (5 minutes before start):
    </p>
    <p style="margin:0 0 20px 0;">
      <a href="${url}" style="display:inline-block; padding:10px 14px; border-radius:10px; background:#111827; color:#fff; text-decoration:none;">
        Open Comedy Writing Room
      </a>
    </p>
    <p style="margin:0; color:#6b7280; font-size:12px;">
      Tip: join opens 5 minutes before start.
    </p>
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
    args.label === "24h" ? "Reminder ⏰ Tomorrow" : "Reminder ⏰ Starting soon";

  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5;">
    <h2 style="margin:0 0 12px 0;">${headline}</h2>
    <p style="margin:0 0 12px 0;">
      <strong>${escapeHtml(args.sessionTitle)}</strong>
    </p>
    <p style="margin:0 0 16px 0;">
      <strong>When:</strong> ${escapeHtml(whenLocal)}
    </p>
    <p style="margin:0 0 20px 0;">
      <a href="${url}" style="display:inline-block; padding:10px 14px; border-radius:10px; background:#111827; color:#fff; text-decoration:none;">
        Open Comedy Writing Room
      </a>
    </p>
    <p style="margin:0; color:#6b7280; font-size:12px;">
      Tip: join opens 5 minutes before start.
    </p>
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