import { DateTime } from "luxon";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SessionRow = {
  id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  seat_cap: number;
  status: string;
  zoom_link: string | null;
};

function isAdmin(userId: string | null | undefined) {
  if (!userId) return false;
  const raw = process.env.ADMIN_USER_IDS || "";
  const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(userId);
}

function formatWhenNYC(startsAtIso: string) {
  const d = new Date(startsAtIso);
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminPage() {
  const { userId } = auth();
  if (!isAdmin(userId)) redirect("/");

  async function createSession(formData: FormData) {
    "use server";

    const { userId } = auth();
    if (!isAdmin(userId)) throw new Error("Not authorized");

    const title = String(formData.get("title") || "Daily Writing Room");
    const startsAtLocal = String(formData.get("starts_at") || "");
    const duration = Number(formData.get("duration_minutes") || 60);
    const seatCap = Number(formData.get("seat_cap") || 5);
    const zoomLinkRaw = String(formData.get("zoom_link") || "").trim();

    if (!startsAtLocal) throw new Error("Missing start time");

    const dt = DateTime.fromFormat(startsAtLocal, "yyyy-MM-dd'T'HH:mm", {
      zone: "America/New_York",
    });

    if (!dt.isValid) throw new Error(`Invalid start time: ${startsAtLocal}`);

    const startsAtUtcIso = dt.toUTC().toISO();
    if (!startsAtUtcIso) throw new Error("Failed to convert start time");

    const zoom_link = zoomLinkRaw.length ? zoomLinkRaw : null;

    const { error } = await supabaseAdmin.from("sessions").insert({
      title,
      starts_at: startsAtUtcIso,
      duration_minutes: duration,
      seat_cap: seatCap,
      status: "scheduled",
      zoom_link,
    });

    if (error) throw new Error(error.message);

    redirect("/sessions");
  }

  async function updateZoomLink(formData: FormData) {
    "use server";

    const { userId } = auth();
    if (!isAdmin(userId)) throw new Error("Not authorized");

    const sessionId = String(formData.get("sessionId") || "");
    const zoomLinkRaw = String(formData.get("zoom_link") || "").trim();
    const zoom_link = zoomLinkRaw.length ? zoomLinkRaw : null;

    if (!sessionId) throw new Error("Missing sessionId");

    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ zoom_link })
      .eq("id", sessionId);

    if (error) throw new Error(error.message);

    redirect("/admin");
  }

  async function clearZoomLink(formData: FormData) {
    "use server";

    const { userId } = auth();
    if (!isAdmin(userId)) throw new Error("Not authorized");

    const sessionId = String(formData.get("sessionId") || "");
    if (!sessionId) throw new Error("Missing sessionId");

    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ zoom_link: null })
      .eq("id", sessionId);

    if (error) throw new Error(error.message);

    redirect("/admin");
  }

  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("sessions")
    .select("id,title,starts_at,duration_minutes,seat_cap,status,zoom_link")
    .order("starts_at", { ascending: true });

  if (sessionsError) {
    return (
      <main className="min-h-screen p-10 max-w-3xl mx-auto space-y-6">
        <pre>{JSON.stringify(sessionsError, null, 2)}</pre>
      </main>
    );
  }

  const typedSessions = (sessions ?? []) as SessionRow[];

  return (
    <main className="min-h-screen p-10 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <div className="flex gap-3">
          <Link className="underline" href="/sessions">
            Sessions
          </Link>
          <Link className="underline" href="/">
            Home
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Create a session</h2>

        <form action={createSession} className="space-y-4 border rounded p-4">
          <div className="space-y-1">
            <label className="text-sm opacity-70">Title</label>
            <input
              name="title"
              defaultValue="Daily Writing Room"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm opacity-70">Start time (NYC)</label>
            <input
              name="starts_at"
              type="datetime-local"
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm opacity-70">Duration (min)</label>
              <input
                name="duration_minutes"
                type="number"
                defaultValue={60}
                className="w-full border rounded px-3 py-2"
                min={5}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm opacity-70">Seat cap</label>
              <input
                name="seat_cap"
                type="number"
                defaultValue={5}
                className="w-full border rounded px-3 py-2"
                min={1}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm opacity-70">Zoom link (optional)</label>
            <input
              name="zoom_link"
              placeholder="https://zoom.us/j/..."
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <button className="px-4 py-2 rounded bg-black text-white">
            Create session
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Edit Zoom links</h2>
        <p className="text-sm opacity-60">
          Update a session’s Zoom link. Users only see it after they join.
        </p>

        <div className="space-y-3">
          {typedSessions.map((s) => (
            <div key={s.id} className="border rounded p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-sm opacity-70">
                    {formatWhenNYC(s.starts_at)} • {s.duration_minutes} min • cap{" "}
                    {s.seat_cap}
                  </div>
                </div>

                <Link className="underline text-sm" href="/sessions">
                  View
                </Link>
              </div>

              <form action={updateZoomLink} className="flex gap-2">
                <input type="hidden" name="sessionId" value={s.id} />
                <input
                  name="zoom_link"
                  defaultValue={s.zoom_link ?? ""}
                  placeholder="https://zoom.us/j/..."
                  className="flex-1 border rounded px-3 py-2"
                />
                <button className="px-3 py-2 rounded bg-black text-white">
                  Save
                </button>
              </form>

              <form action={clearZoomLink}>
                <input type="hidden" name="sessionId" value={s.id} />
                <button className="text-sm underline opacity-70">
                  Clear zoom link
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
