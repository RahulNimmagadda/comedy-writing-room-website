import { DateTime } from "luxon";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isAdmin(userId: string | null | undefined) {
  if (!userId) return false;
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .includes(userId);
}

export default async function AdminPage() {
  const { userId } = auth();
  if (!isAdmin(userId)) redirect("/");

  async function createSession(formData: FormData) {
    "use server";

    const title = String(formData.get("title") || "");
    const startsAtLocal = String(formData.get("starts_at") || "");
    const zoomLink = String(formData.get("zoom_link") || "").trim();

    if (!startsAtLocal) throw new Error("Missing start time");

    const dt = DateTime.fromFormat(startsAtLocal, "yyyy-MM-dd'T'HH:mm", {
      zone: "America/New_York",
    });

    const startsAtUtc = dt.toUTC().toISO();

    await supabaseAdmin.from("sessions").insert({
      title,
      starts_at: startsAtUtc,
      duration_minutes: 60,
      seat_cap: 5,
      status: "scheduled",
      zoom_link: zoomLink || null,
    });

    redirect("/sessions");
  }

  const { data: sessions } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .order("starts_at", { ascending: true });

  return (
    <main className="max-w-3xl mx-auto p-10 space-y-6">
      <h1 className="text-2xl font-bold">Admin</h1>

      <section className="border p-4 space-y-3 rounded">
        <h2>Create Session</h2>

        <form action={createSession} className="space-y-2">
          <input name="title" defaultValue="Daily Writing Room" className="border p-2 w-full" />

          <input
            name="starts_at"
            type="datetime-local"
            className="border p-2 w-full"
            required
          />

          <input
            name="zoom_link"
            placeholder="Zoom link (optional if DEFAULT_ZOOM_LINK is set)"
            className="border p-2 w-full"
          />

          <button className="bg-black text-white p-2 rounded">
            Create
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {sessions?.map((s) => (
          <div key={s.id} className="border p-3 rounded">
            <div>{s.title}</div>
            <div className="text-sm opacity-70">
              {new Date(s.starts_at).toLocaleString()}
            </div>
          </div>
        ))}
      </section>

      <Link href="/">Back</Link>
    </main>
  );
}