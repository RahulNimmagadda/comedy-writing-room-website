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

type ZoomRoomRow = {
  room_number: number;
  room_label: string;
  zoom_link: string;
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

  const [{ data: sessions, error }, { data: zoomRooms, error: zoomRoomsError }] =
    await Promise.all([
      supabaseAdmin
        .from("sessions")
        .select(
          "id,title,starts_at,duration_minutes,seat_cap,status,zoom_link,price_cents"
        )
        .order("starts_at", { ascending: true }),
      supabaseAdmin
        .from("zoom_rooms")
        .select("room_number,room_label,zoom_link")
        .order("room_number", { ascending: true }),
    ]);

  if (error || zoomRoomsError) {
    return (
      <main className="min-h-screen max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Admin · Sessions</h1>
        <pre className="p-4 border rounded bg-white overflow-auto">
          {JSON.stringify({ sessionsError: error, zoomRoomsError }, null, 2)}
        </pre>
      </main>
    );
  }

  const rows = (sessions ?? []) as SessionRow[];
  const rooms = (zoomRooms ?? []) as ZoomRoomRow[];

  // Map zoom_link -> room_number for defaulting the dropdown on edit
  const zoomLinkToRoomNumber = new Map<string, number>();
  for (const r of rooms) zoomLinkToRoomNumber.set(r.zoom_link, r.room_number);

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
            <b>Community</b> suggestion: price <b>$1</b>, seat cap <b>5</b> (auto-splitting total cap = 25).
          </div>
          <div>
            <b>Pro</b> suggestion: price <b>$5</b>, seat cap <b>5</b> (strict total cap = 5). Consider setting a single-room override.
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

          {/* NEW: recurrence */}
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

          <select
            name="zoom_room_number"
            className="border rounded px-3 py-2 md:col-span-4"
            defaultValue=""
          >
            <option value="">
              Zoom room (optional) — choose to set a single-room override
            </option>
            {rooms.map((r) => (
              <option key={r.room_number} value={String(r.room_number)}>
                {r.room_number} — {r.room_label}
              </option>
            ))}
          </select>

          <input
            name="zoom_link"
            className="border rounded px-3 py-2 md:col-span-5"
            placeholder="Zoom link override (optional)"
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
          Zoom behavior: selecting a Zoom room sets a <b>single-room override</b>{" "}
          (everyone goes to the same link). Leave both fields blank to use the
          default auto-splitting rooms.
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
              const defaultRoomNumber =
                s.zoom_link && zoomLinkToRoomNumber.has(s.zoom_link)
                  ? String(zoomLinkToRoomNumber.get(s.zoom_link)!)
                  : "";

              const isOverridden = !!(s.zoom_link && s.zoom_link.trim().length > 0);

              return (
                <div
                  key={s.id}
                  className="border rounded bg-white p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm opacity-70">
                      <div className="font-mono text-xs opacity-70">
                        id: {s.id}
                      </div>
                      <div className="text-xs mt-1">
                        Starts (NYC): <b>{utcIsoToNycDatetimeLocal(s.starts_at)}</b>
                      </div>
                      <div className="text-xs mt-1">
                        Zoom mode:{" "}
                        <b>{isOverridden ? "Single-room override" : "Auto-splitting"}</b>
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
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                  >
                    <input type="hidden" name="id" value={s.id} />

                    <div className="md:col-span-4">
                      <label className="text-xs opacity-60">Title</label>
                      <input
                        name="title"
                        className="border rounded px-3 py-2 w-full"
                        defaultValue={s.title}
                        required
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="text-xs opacity-60">
                        Starts at (NYC)
                      </label>
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
                      <label className="text-xs opacity-60">Price ($)</label>
                      <input
                        name="price_dollars"
                        type="number"
                        min={0}
                        step="0.01"
                        className="border rounded px-3 py-2 w-full"
                        defaultValue={centsToDollarsString(s.price_cents)}
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
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

                    <div className="md:col-span-4">
                      <label className="text-xs opacity-60">
                        Zoom room (optional)
                      </label>
                      <select
                        name="zoom_room_number"
                        className="border rounded px-3 py-2 w-full"
                        defaultValue={defaultRoomNumber}
                      >
                        <option value="">
                          (no room selected) — use manual link below / auto-splitting if blank
                        </option>
                        {rooms.map((r) => (
                          <option key={r.room_number} value={String(r.room_number)}>
                            {r.room_number} — {r.room_label}
                          </option>
                        ))}
                      </select>
                      <div className="text-[11px] opacity-60 mt-1">
                        If a room is selected, the manual link is ignored.
                      </div>
                    </div>

                    <div className="md:col-span-6">
                      <label className="text-xs opacity-60">
                        Zoom link override (optional)
                      </label>
                      <input
                        name="zoom_link"
                        className="border rounded px-3 py-2 w-full"
                        defaultValue={s.zoom_link ?? ""}
                        placeholder="Leave blank to clear (unless room selected)"
                      />
                      <div className="text-[11px] opacity-60 mt-1">
                        To return to auto-splitting: set Zoom room to “no room selected” and clear this link.
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <button className="px-3 py-2 rounded bg-black text-white w-full">
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
