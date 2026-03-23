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

function dollarsToCents(value: FormDataEntryValue | null) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export default async function AdminPage() {
  const { userId } = auth();
  if (!isAdmin(userId)) redirect("/");

  async function createSession(formData: FormData) {
    "use server";

    const title = String(formData.get("title") || "").trim();
    const startsAtLocal = String(formData.get("starts_at") || "");
    const zoomLink = String(formData.get("zoom_link") || "").trim();
    const priceCents = dollarsToCents(formData.get("price"));

    if (!title) throw new Error("Missing title");
    if (!startsAtLocal) throw new Error("Missing start time");

    const dt = DateTime.fromFormat(startsAtLocal, "yyyy-MM-dd'T'HH:mm", {
      zone: "America/New_York",
    });

    if (!dt.isValid) throw new Error("Invalid start time");

    const startsAtUtc = dt.toUTC().toISO();

    await supabaseAdmin.from("sessions").insert({
      title,
      starts_at: startsAtUtc,
      duration_minutes: 60,
      seat_cap: 9999,
      status: "scheduled",
      price_cents: priceCents,
      zoom_link: zoomLink || null,
    });

    redirect("/admin");
  }

  async function updateSession(formData: FormData) {
    "use server";

    const id = String(formData.get("id") || "");
    const title = String(formData.get("title") || "").trim();
    const startsAtLocal = String(formData.get("starts_at") || "");
    const zoomLink = String(formData.get("zoom_link") || "").trim();
    const priceCents = dollarsToCents(formData.get("price"));

    if (!id) throw new Error("Missing id");
    if (!title) throw new Error("Missing title");
    if (!startsAtLocal) throw new Error("Missing start time");

    const dt = DateTime.fromFormat(startsAtLocal, "yyyy-MM-dd'T'HH:mm", {
      zone: "America/New_York",
    });

    if (!dt.isValid) throw new Error("Invalid start time");

    const startsAtUtc = dt.toUTC().toISO();

    await supabaseAdmin
      .from("sessions")
      .update({
        title,
        starts_at: startsAtUtc,
        zoom_link: zoomLink || null,
        price_cents: priceCents,
      })
      .eq("id", id);

    redirect("/admin");
  }

  const { data: sessions } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .order("starts_at", { ascending: true });

  return (
    <main className="max-w-3xl mx-auto p-10 space-y-6">
      <h1 className="text-2xl font-bold">Admin</h1>

      <section className="border p-4 space-y-3 rounded">
        <h2 className="font-semibold">Create Session</h2>

        <form action={createSession} className="space-y-2">
          <input
            name="title"
            defaultValue="Daily Writing Room"
            className="border p-2 w-full"
          />

          <input
            name="starts_at"
            type="datetime-local"
            className="border p-2 w-full"
            required
          />

          <input
            name="zoom_link"
            placeholder="Zoom link (optional)"
            className="border p-2 w-full"
          />

          <select
            name="price"
            defaultValue="1"
            className="border p-2 w-full bg-white"
          >
            <option value="0">Free</option>
            <option value="1">Community ($1)</option>
            <option value="5">Pro ($5)</option>
          </select>

          <button className="bg-black text-white p-2 rounded w-full">
            Create
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {sessions?.map((s) => {
          const local = DateTime.fromISO(s.starts_at, {
            zone: "utc",
          }).setZone("America/New_York");

          return (
            <form
              key={s.id}
              action={updateSession}
              className="border p-4 rounded space-y-2"
            >
              <input type="hidden" name="id" value={s.id} />

              <div className="font-semibold">{s.title}</div>

              <input
                name="title"
                defaultValue={s.title}
                className="border p-2 w-full"
              />

              <input
                name="starts_at"
                type="datetime-local"
                defaultValue={local.toFormat("yyyy-MM-dd'T'HH:mm")}
                className="border p-2 w-full"
              />

              <input
                name="zoom_link"
                defaultValue={s.zoom_link || ""}
                className="border p-2 w-full"
              />

              <select
                name="price"
                defaultValue={String((s.price_cents ?? 0) / 100)}
                className="border p-2 w-full bg-white"
              >
                <option value="0">Free</option>
                <option value="1">Community ($1)</option>
                <option value="5">Pro ($5)</option>
              </select>

              <div className="flex justify-between items-center">
                <div className="text-sm opacity-60">
                  {new Date(s.starts_at).toLocaleString()}
                </div>

                <button className="bg-black text-white px-3 py-1 rounded">
                  Save
                </button>
              </div>
            </form>
          );
        })}
      </section>

      <Link href="/">Back</Link>
    </main>
  );
}