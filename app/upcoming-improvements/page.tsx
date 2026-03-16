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
        "We're expanding session times so comics in Europe, Australia, and other regions can join rooms without having to wake up at 3am.",
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
      title: "Host your own writing sessions",
      description:
        "Comics will be able to create and host their own writing rooms — set pricing, choose room caps, schedule sessions, and run rooms for their own communities.",
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      ),
    },
    {
      title: "More to come",
      description:
        "We're building this with the community. The best improvements come directly from comics who use the room.",
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
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          We&apos;re building this with the community. Here&apos;s what&apos;s
          coming.
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
          href="mailto:hello@comedywritingroom.com"
          className="font-semibold text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-500"
        >
          hello@comedywritingroom.com
        </Link>
      </div>
    </div>
  );
}