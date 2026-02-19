import Link from "next/link";

type Item = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

function Card({ item }: { item: Item }) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white/70 px-6 py-5 shadow-sm backdrop-blur">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100/70 text-amber-900">
          {item.icon}
        </div>

        <div className="min-w-0">
          <div className="text-base font-semibold tracking-tight text-zinc-900">
            {item.title}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600">
            {item.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UpcomingImprovementsPage() {
  const items: Item[] = [
    {
      title: "More sessions across timezones",
      description:
        "We’re adding sessions at times that work for comics in Europe, Australia, and beyond — so no one has to wake up at 3am for a writing room.",
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12a9 9 0 1 1-9-9" />
          <path d="M21 3v9h-9" />
        </svg>
      ),
    },
    {
      title: "Session search + filtering",
      description:
        "Filter sessions by time, day, timezone, or host. Quickly find the rooms that fit your schedule.",
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 21l-4.3-4.3" />
          <circle cx="10.5" cy="10.5" r="6.5" />
        </svg>
      ),
    },
    {
      title: "Zoom API automation",
      description:
        "Automatically create a dedicated Zoom room (and secondary rooms for overflow) for each session. No more manual links — each session gets a fresh, unique link.",
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M15 10l4-2v8l-4-2v-4z" />
          <rect x="3" y="7" width="12" height="10" rx="2" />
        </svg>
      ),
    },
    {
      title: "More to come",
      description:
        "We’re listening. The best improvements come from people who actually use the room.",
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">
          Upcoming Improvements
        </h1>
        <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
          We’re building this with the community. Here’s what’s coming.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.title} item={item} />
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-200/70 bg-white/70 px-6 py-6 text-sm text-zinc-700 shadow-sm">
        Want to suggest something?{" "}
        <Link
          href="/contact"
          className="font-semibold text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-500"
        >
          Send feedback
        </Link>
        .
      </div>
    </div>
  );
}
