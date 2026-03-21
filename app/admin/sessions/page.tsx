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

/**
 * UTC ISO -> "YYYY-MM-DDTHH:mm" for <input type="datetime-local" />
 * Display as NYC wall time (DST-aware).
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

function centsToDollarsString(cents: number) {
  const dollars = (cents ?? 0) / 100;
  return String(Number.isFinite(dollars) ? dollars : 0);
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
      <main className="min-h-screen max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Admin · Sessions</h1>
        <pre className="p-4 border rounded bg-white overflow-auto">
          {JSON.stringify({ sessionsError: error }, null, 2)}
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
        <div className="font-semibold">Create session(s)</div>

        <div className="text-xs opacity-70 leading-relaxed">
          <div>
            <b>Community</b> suggestion: price <b>$1</b>, seat cap <b>5</b>.
          </div>
          <div>
            <b>Pro</b> suggestion: price <b>$5</b>, seat cap <b>5</b>.
          </div>
          <div>
            Every session should have one Zoom link. Everyone joins that room,
            and breakout rooms are handled inside Zoom.
          </div>
        </div>

        <form
          action={createSession}
          className="grid grid-cols-1 md:grid-cols-12 gap-3"
        >
          <input
            name="title"
            className="border rounded px-3 py-2 md:col-span-4"
            placeholder="Daily Writing Room"
            required
          />

          <input
            name="starts_at_local"
            type="datetime-local"
            className="border rounded px-3 py-2 md:col-span-3"
            required
          />

          <input
            name="duration_minutes"
            type="number"
            min={1}
            className="border rounded px-3 py-2 md:col-span-2"
            placeholder="60"
            defaultValue={60}
            required
          />

          <input
            name="seat_cap"
            type="number"
            min={1}
            className="border rounded px-3 py-2 md:col-span-1"
            placeholder="5"
            defaultValue={5}
            required
          />

          <input
            name="price_dollars"
            type="number"
            min={0}
            step="0.01"
            className="border rounded px-3 py-2 md:col-span-2"
            placeholder="1.00"
            defaultValue={1}
            required
          />

          <select
            name="status"
            className="border rounded px-3 py-2 md:col-span-3"
            defaultValue="scheduled"
          >
            <option value="scheduled">scheduled</option>
            <option value="cancelled">cancelled</option>
            <option value="completed">completed</option>
          </select>

          <div className="md:col-span-3">
            <label className="text-xs opacity-70">
              Repeat weekly (additional weeks)
            </label>
            <input
              name="repeat_weeks"
              type="number"
              min={0}
              className="border rounded px-3 py-2 w-full"
              defaultValue={0}
            />
            <div className="text-[11px] opacity-60 mt-1">
              0 = one-time. 7 = creates 8 sessions total (this week + next 7).
            </div>
          </div>

          <input
            name="zoom_link"
            className="border rounded px-3 py-2 md:col-span-9"
            placeholder="https://zoom.us/j/..."
            required
          />

          <button className="md:col-span-12 px-3 py-2 rounded bg-black text-white">
            Create
          </button>
        </form>

        <p className="text-xs opacity-60">
          Note: time is interpreted in <b>New York time</b> (America/New_York)
          and stored as UTC ISO.
        </p>
        <p className="text-xs opacity-60">
          Single-room mode: everyone joins the same Zoom room for the session.
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
            {rows.map((s) => {
              const isOverridden = !!(s.zoom_link && s.zoom_link.trim().length > 0);

              return (
                <section key={s.id} className="border rounded bg-white p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">{s.title}</div>
                      <div className="text-sm opacity-70">
                        {new Date(s.starts_at).toLocaleString("en-US", {
                          timeZone: NYC_TZ,
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        • {s.duration_minutes} min • cap {s.seat_cap} •{" "}
                        {s.status} • ${centsToDollarsString(s.price_cents)}
                      </div>
                    </div>

                    <form action={deleteSession}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-sm underline text-red-600">
                        Delete
                      </button>
                    </form>
                  </div>

                  <form
                    action={updateSession}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3"
                  >
                    <input type="hidden" name="id" value={s.id} />

                    <input
                      name="title"
                      defaultValue={s.title}
                      className="border rounded px-3 py-2 md:col-span-4"
                      required
                    />

                    <input
                      name="starts_at_local"
                      type="datetime-local"
                      defaultValue={utcIsoToNycDatetimeLocal(s.starts_at)}
                      className="border rounded px-3 py-2 md:col-span-3"
                      required
                    />

                    <input
                      name="duration_minutes"
                      type="number"
                      min={1}
                      defaultValue={s.duration_minutes}
                      className="border rounded px-3 py-2 md:col-span-1"
                      required
                    />

                    <input
                      name="seat_cap"
                      type="number"
                      min={1}
                      defaultValue={s.seat_cap}
                      className="border rounded px-3 py-2 md:col-span-1"
                      required
                    />

                    <input
                      name="price_dollars"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={centsToDollarsString(s.price_cents)}
                      className="border rounded px-3 py-2 md:col-span-1"
                      required
                    />

                    <select
                      name="status"
                      defaultValue={s.status}
                      className="border rounded px-3 py-2 md:col-span-2"
                    >
                      <option value="scheduled">scheduled</option>
                      <option value="cancelled">cancelled</option>
                      <option value="completed">completed</option>
                    </select>

                    <input
                      name="zoom_link"
                      defaultValue={s.zoom_link ?? ""}
                      className="border rounded px-3 py-2 md:col-span-12"
                      placeholder="https://zoom.us/j/..."
                      required
                    />

                    <div className="md:col-span-12 text-xs opacity-60">
                      {isOverridden
                        ? "This session has a Zoom link set."
                        : "Add a Zoom link so attendees can join the shared room."}
                    </div>

                    <button className="md:col-span-12 px-3 py-2 rounded bg-black text-white">
                      Save changes
                    </button>
                  </form>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}