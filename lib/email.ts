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

export function formatNYC(iso: string) {
  const d = new Date(iso);
  // Use America/New_York (you can rename display later)
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function confirmationEmailHtml(args: {
  sessionTitle: string;
  startsAtIso: string;
}) {
  const whenNYC = formatNYC(args.startsAtIso);
  const url = siteUrl();

  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5;">
    <h2 style="margin:0 0 12px 0;">You’re in ✅</h2>
    <p style="margin:0 0 12px 0;">
      You’re signed up for <strong>${escapeHtml(args.sessionTitle)}</strong>.
    </p>
    <p style="margin:0 0 16px 0;">
      <strong>When (NYC time):</strong> ${escapeHtml(whenNYC)}
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
      Tip: this email shows NYC time. Your device may display the session in your local time on the website.
    </p>
  </div>
  `;
}

export function reminderEmailHtml(args: {
  sessionTitle: string;
  startsAtIso: string;
  label: "24h" | "1h";
}) {
  const whenNYC = formatNYC(args.startsAtIso);
  const url = siteUrl();

  const headline = args.label === "24h" ? "Reminder ⏰ Tomorrow" : "Reminder ⏰ Starting soon";

  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5;">
    <h2 style="margin:0 0 12px 0;">${headline}</h2>
    <p style="margin:0 0 12px 0;">
      <strong>${escapeHtml(args.sessionTitle)}</strong>
    </p>
    <p style="margin:0 0 16px 0;">
      <strong>When (NYC time):</strong> ${escapeHtml(whenNYC)}
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