export default function HowItWorksPage() {
  const sections = [
    {
      title: "Session Format",
      subtitle: "60 minutes",
      items: [
        "Max 4 comics per room (rooms will be split automatically if more than 4 comics sign up)",
        "Quick intros",
        "~10 minutes per comic (more if the room isn’t full)",
        "Run bits, premises, or rough ideas",
        "Structured, actionable feedback",
      ],
      icon: "🎤",
    },
    {
      title: "What To Bring",
      subtitle: "Come prepared",
      items: [
        "1–3 ideas you're actively working on",
        "Openness to feedback",
        "Willingness to give thoughtful notes",
      ],
      icon: "📝",
    },
    {
      title: "Room Norms",
      subtitle: "Keep it useful",
      items: [
        "No hogging time",
        "No punching down",
        "Respect confidentiality",
        "Specific feedback > vague praise",
      ],
      icon: "🤝",
    },
  ];

  return (
    <main className="max-w-5xl mx-auto px-6 py-14">
      <div className="max-w-3xl space-y-4">
        <h1 className="text-5xl font-bold tracking-tight text-neutral-900">
          How It Works
        </h1>
        <p className="text-lg text-neutral-600">
          Fast, structured writing sessions for comics who want better jokes,
          clearer feedback, and consistent reps.
        </p>
      </div>

      <div className="mt-10 grid gap-6">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-3xl border border-neutral-200 bg-white/80 p-6 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-xl">
                {section.icon}
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <h2 className="text-2xl font-semibold text-neutral-900">
                      {section.title}
                    </h2>
                    <span className="text-sm font-medium text-neutral-500">
                      {section.subtitle}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 text-neutral-700">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-1 text-amber-600">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-3xl border border-neutral-200 bg-white/80 p-6 shadow-sm">
        <p className="text-neutral-700">
          The goal is simple: help each comic leave with stronger material, not
          just good vibes.
        </p>
      </section>
    </main>
  );
}
