export const metadata = {
  title: "Upcoming Improvements | Comedy Writing Room",
  description:
    "See what we’re building next based on feedback from the Comedy Writing Room community.",
};

export default function UpcomingImprovementsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">
        Upcoming Improvements 🚀
      </h1>

      <p className="mt-4 text-base leading-7 text-gray-600">
        We’re building this with you. Every tweak, new session, and feature
        comes directly from feedback in the rooms. As the community grows,
        we’re rolling out improvements to make this the best writing gym for
        comics anywhere in the world.
      </p>

      <div className="mt-10 space-y-10">
        {/* 1. More Sessions */}
        <section>
          <h2 className="text-xl font-semibold">
            1️⃣ More Sessions (Across Timezones)
          </h2>

          <p className="mt-3 leading-7 text-gray-600">
            As the community grows, we’re adding more sessions across different
            timezones. For now, we’re making sure each session has a trusted
            Comedy Writing Room host to keep feedback structured and high-value.
          </p>

          <p className="mt-3 leading-7 text-gray-600">
            If you’d like to add a session (and be a host), suggest a time{" "}
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSddb6YHQoTvV11H_y85w4SYG_UhLCXhhJ9FPVF27zTkYJCDbQ/viewform?usp=header"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              here
            </a>
            .
          </p>
        </section>

        {/* 2. Organizing Sessions Page */}
        <section>
          <h2 className="text-xl font-semibold">
            2️⃣ Organizing the Sessions Page
          </h2>

          <p className="mt-3 leading-7 text-gray-600">
            As we get more hosts and sessions, we’ll update the home page so
            you can search and sign up by day and time.
          </p>

          <ul className="mt-4 list-disc space-y-2 pl-5 text-gray-600">
            <li>Search by day</li>
            <li>Filter by time</li>
            <li>View sessions by timezone</li>
            <li>Sign up in one click</li>
          </ul>
        </section>

        {/* 3. Premium Room */}
        <section>
          <h2 className="text-xl font-semibold">
            3️⃣ Weekly “Premium” Room ($20)
          </h2>

          <p className="mt-3 leading-7 text-gray-600">
            For comics who are serious about their craft.
          </p>

          <ul className="mt-4 list-disc space-y-2 pl-5 text-gray-600">
            <li>$20 sign-ups</li>
            <li>Moderated by semi-pro+ comics</li>
            <li>Smaller, high-intent room</li>
            <li>Guaranteed actionable feedback</li>
          </ul>

          <p className="mt-3 leading-7 text-gray-600">
            This ensures the people in the room with you are also serious about
            improving — and that you leave with concrete notes, tags, and
            rewrites.
          </p>
        </section>
      </div>
    </main>
  );
}
