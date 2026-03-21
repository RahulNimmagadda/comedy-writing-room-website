import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
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
          <input name="title" placeholder="Title" className="border p-2" required />

          <input
            name="starts_at_local"
            type="datetime-local"
            className="border p-2"
            required
          />

          <input
            name="duration_minutes"
            type="number"
            defaultValue={60}
            className="border p-2"
          />

          <input
            name="seat_cap"
            type="number"
            defaultValue={5}
            className="border p-2"
          />

          <input
            name="price_dollars"
            type="number"
            defaultValue={1}
            className="border p-2"
          />

          <input
            name="zoom_link"
            placeholder="Zoom link (optional if DEFAULT_ZOOM_LINK is set)"
            className="border p-2"
          />

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

              <input name="title" defaultValue={s.title} className="border p-2" />

              <input
                name="starts_at_local"
                type="datetime-local"
                defaultValue={utcIsoToNycDatetimeLocal(s.starts_at)}
                className="border p-2"
              />

              <input
                name="zoom_link"
                defaultValue={s.zoom_link ?? ""}
                placeholder="Zoom link (optional if DEFAULT_ZOOM_LINK is set)"
                className="border p-2"
              />

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