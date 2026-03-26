import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSession, deleteSession, updateSession } from "./actions";

type SessionRow = {
  id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  seat_cap: number;
  status: string;
  zoom_link: string | null;
  price_cents: number;
};

function requireAdmin() {
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

function utcIsoToNycDatetimeLocal(utcIso: string) {
  const d = new Date(utcIso);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NYC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get(
    "minute"
  )}`;
}

function centsToDollarsString(cents: number) {
  return ((cents ?? 0) / 100).toFixed(2);
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="grid gap-1.5">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      {children}
    </label>
  );
}

export default async function AdminSessionsPage() {
  requireAdmin();

  const { data: sessions, error } = await supabaseAdmin
    .from("sessions")
    .select(
      "id,title,starts_at,duration_minutes,seat_cap,status,zoom_link,price_cents"
    )
    .order("starts_at", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen max-w-4xl mx-auto p-6">
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </main>
    );
  }

  const rows = (sessions ?? []) as SessionRow[];

  return (
    <main className="min-h-screen max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Admin · Sessions</h1>
        <Link href="/" className="underline">
          Back
        </Link>
      </div>

      {/* Create */}
      <section className="border rounded p-4 space-y-3">
        <div className="font-semibold">Create session</div>

        <form action={createSession} className="grid gap-3">
          <Field label="Title" htmlFor="create-title">
            <input
              id="create-title"
              name="title"
              placeholder="CDMX Secret Comedy Brunch"
              className="border p-2"
              required
            />
          </Field>

          <Field
            label="Start time (New York time)"
            htmlFor="create-starts-at-local"
          >
            <input
              id="create-starts-at-local"
              name="starts_at_local"
              type="datetime-local"
              className="border p-2"
              required
            />
          </Field>

          <Field label="Session length (minutes)" htmlFor="create-duration">
            <input
              id="create-duration"
              name="duration_minutes"
              type="number"
              defaultValue={60}
              min={0}
              className="border p-2"
            />
          </Field>

          <Field label="Seat cap" htmlFor="create-seat-cap">
            <input
              id="create-seat-cap"
              name="seat_cap"
              type="number"
              defaultValue={5}
              min={1}
              className="border p-2"
            />
          </Field>

          <Field label="Price (USD)" htmlFor="create-price-dollars">
            <input
              id="create-price-dollars"
              name="price_dollars"
              type="number"
              defaultValue={1}
              min={0}
              step="0.01"
              className="border p-2"
            />
          </Field>

          <Field label="Status" htmlFor="create-status">
            <select
              id="create-status"
              name="status"
              defaultValue="scheduled"
              className="border p-2"
            >
              <option value="scheduled">Scheduled</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </Field>

          <Field label="Zoom link" htmlFor="create-zoom-link">
            <input
              id="create-zoom-link"
              name="zoom_link"
              placeholder="Optional if DEFAULT_ZOOM_LINK is set"
              className="border p-2"
            />
          </Field>

          <button className="bg-black text-white p-2 rounded">
            Create
          </button>
        </form>
      </section>

      {/* List */}
      <section className="space-y-3">
        {rows.map((s) => (
          <div key={s.id} className="border p-4 rounded space-y-2">
            <div className="font-semibold">{s.title}</div>
            <div className="text-sm opacity-70">
              {new Date(s.starts_at).toLocaleString("en-US", {
                timeZone: NYC_TZ,
              })}{" "}
              • ${centsToDollarsString(s.price_cents)}
            </div>

            <form action={updateSession} className="grid gap-2">
              <input type="hidden" name="id" value={s.id} />

              <Field label="Title" htmlFor={`title-${s.id}`}>
                <input
                  id={`title-${s.id}`}
                  name="title"
                  defaultValue={s.title}
                  className="border p-2"
                />
              </Field>

              <Field
                label="Start time (New York time)"
                htmlFor={`starts-at-local-${s.id}`}
              >
                <input
                  id={`starts-at-local-${s.id}`}
                  name="starts_at_local"
                  type="datetime-local"
                  defaultValue={utcIsoToNycDatetimeLocal(s.starts_at)}
                  className="border p-2"
                />
              </Field>

              <Field
                label="Session length (minutes)"
                htmlFor={`duration-minutes-${s.id}`}
              >
                <input
                  id={`duration-minutes-${s.id}`}
                  name="duration_minutes"
                  type="number"
                  defaultValue={s.duration_minutes}
                  min={0}
                  className="border p-2"
                />
              </Field>

              <Field label="Seat cap" htmlFor={`seat-cap-${s.id}`}>
                <input
                  id={`seat-cap-${s.id}`}
                  name="seat_cap"
                  type="number"
                  defaultValue={s.seat_cap}
                  min={1}
                  className="border p-2"
                />
              </Field>

              <Field label="Price (USD)" htmlFor={`price-dollars-${s.id}`}>
                <input
                  id={`price-dollars-${s.id}`}
                  name="price_dollars"
                  type="number"
                  defaultValue={centsToDollarsString(s.price_cents)}
                  min={0}
                  step="0.01"
                  className="border p-2"
                />
              </Field>

              <Field label="Status" htmlFor={`status-${s.id}`}>
                <select
                  id={`status-${s.id}`}
                  name="status"
                  defaultValue={s.status}
                  className="border p-2"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </Field>

              <Field label="Zoom link" htmlFor={`zoom-link-${s.id}`}>
                <input
                  id={`zoom-link-${s.id}`}
                  name="zoom_link"
                  defaultValue={s.zoom_link ?? ""}
                  placeholder="Optional if DEFAULT_ZOOM_LINK is set"
                  className="border p-2"
                />
              </Field>

              <button className="bg-black text-white p-2 rounded">
                Save
              </button>
            </form>

            <form action={deleteSession}>
              <input type="hidden" name="id" value={s.id} />
              <button className="text-red-600 text-sm">Delete</button>
            </form>
          </div>
        ))}
      </section>
    </main>
  );
}
