import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSession, deleteSession, updateSession } from "./actions";

type SessionRow = {
  id: string;
  title: string;
  starts_at: string; // stored as UTC ISO in DB
  duration_minutes: number;
  seat_cap: number;
  status: string;
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

/**
 * UTC ISO -> "YYYY-MM-DDTHH:mm" for <input type="datetime-local" />
 * Display as NYC wall time (DST-aware).
 *
 * IMPORTANT: Your server actions interpret starts_at_local as NYC time,
 * so the admin UI must also display/edit in NYC time to avoid "snapping."
 */
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

export default async function AdminSessionsPage() {
  requireAdmin();

  const { data: sessions, error } = await supabaseAdmin
    .from("sessions")
    .select("id,title,starts_at,duration_minutes,seat_cap,status")
    .order("starts_at", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Admin · Sessions</h1>
        <pre className="p-4 border rounded bg-white overflow-auto">
          {JSON.stringify(error, null, 2)}
        </pre>
      </main>
    );
  }

  const rows = (sessions ?? []) as SessionRow[];

  return (
    <main className="min-h-screen max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin · Sessions</h1>
          <p className="text-sm opacity-70">
            Create, edit, and delete sessions without touching Supabase.
          </p>
        </div>
        <Link href="/" className="text-sm underline opacity-80 hover:opacity-100">
          ← Back to site
        </Link>
      </div>

      {/* Create */}
      <section className="border rounded bg-white p-4 space-y-3">
        <div className="font-semibold">Create a session</div>
        <form
          action={createSession}
          className="grid grid-cols-1 md:grid-cols-6 gap-3"
        >
          <input
            name="title"
            className="border rounded px-3 py-2 md:col-span-2"
            placeholder="Daily Writing Room"
            required
          />
          <input
            name="starts_at_local"
            type="datetime-local"
            className="border rounded px-3 py-2 md:col-span-2"
            required
          />
          <input
            name="duration_minutes"
            type="number"
            min={1}
            className="border rounded px-3 py-2"
            placeholder="60"
            defaultValue={60}
            required
          />
          <input
            name="seat_cap"
            type="number"
            min={1}
            className="border rounded px-3 py-2"
            placeholder="5"
            defaultValue={5}
            required
          />
          <select
            name="status"
            className="border rounded px-3 py-2 md:col-span-2"
            defaultValue="scheduled"
          >
            <option value="scheduled">scheduled</option>
            <option value="cancelled">cancelled</option>
            <option value="completed">completed</option>
          </select>

          <button className="md:col-span-4 px-3 py-2 rounded bg-black text-white">
            Create
          </button>
        </form>
        <p className="text-xs opacity-60">
          Note: time is interpreted in <b>New York time</b> (America/New_York)
          and stored as UTC ISO.
        </p>
      </section>

      {/* List + edit */}
      <section className="space-y-3">
        <div className="font-semibold">Existing sessions</div>

        {rows.length === 0 ? (
          <div className="border rounded bg-white p-4 opacity-70">
            No sessions found.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((s) => (
              <div key={s.id} className="border rounded bg-white p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm opacity-70">
                    <div className="font-mono text-xs opacity-70">
                      id: {s.id}
                    </div>
                  </div>

                  <form action={deleteSession}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="text-sm px-3 py-2 rounded border hover:bg-gray-50">
                      Delete
                    </button>
                  </form>
                </div>

                <form
                  action={updateSession}
                  className="grid grid-cols-1 md:grid-cols-10 gap-3 items-end"
                >
                  <input type="hidden" name="id" value={s.id} />

                  <div className="md:col-span-3">
                    <label className="text-xs opacity-60">Title</label>
                    <input
                      name="title"
                      className="border rounded px-3 py-2 w-full"
                      defaultValue={s.title}
                      required
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs opacity-60">Starts at (NYC)</label>
                    <input
                      name="starts_at_local"
                      type="datetime-local"
                      className="border rounded px-3 py-2 w-full"
                      defaultValue={utcIsoToNycDatetimeLocal(s.starts_at)}
                      required
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="text-xs opacity-60">Minutes</label>
                    <input
                      name="duration_minutes"
                      type="number"
                      min={1}
                      className="border rounded px-3 py-2 w-full"
                      defaultValue={s.duration_minutes}
                      required
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="text-xs opacity-60">Seat cap</label>
                    <input
                      name="seat_cap"
                      type="number"
                      min={1}
                      className="border rounded px-3 py-2 w-full"
                      defaultValue={s.seat_cap}
                      required
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="text-xs opacity-60">Status</label>
                    <select
                      name="status"
                      className="border rounded px-3 py-2 w-full"
                      defaultValue={s.status}
                    >
                      <option value="scheduled">scheduled</option>
                      <option value="cancelled">cancelled</option>
                      <option value="completed">completed</option>
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <button className="px-3 py-2 rounded bg-black text-white w-full">
                      Save
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
