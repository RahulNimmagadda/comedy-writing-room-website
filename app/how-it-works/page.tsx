export default function HowItWorksPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">How The Sessions Work</h1>

      <section className="border rounded p-4 space-y-2">
        <h2 className="font-semibold text-lg">Session Format (60 mins)</h2>
        <ul className="list-disc ml-5 space-y-1">
          <li>Max 5 comics per room</li>
          <li>Quick intros</li>
          <li>~10 minutes per comic (more if the room isn’t full)</li>
          <li>Run bits, premises, or rough ideas</li>
          <li>Structured, actionable feedback</li>
        </ul>
      </section>

      <section className="border rounded p-4 space-y-2">
        <h2 className="font-semibold text-lg">What To Bring</h2>
        <ul className="list-disc ml-5 space-y-1">
          <li>1–3 ideas you&apos;re actively working on</li>
          <li>Openness to feedback</li>
          <li>Willingness to give thoughtful notes</li>
        </ul>
      </section>

      <section className="border rounded p-4 space-y-2">
        <h2 className="font-semibold text-lg">Room Norms</h2>
        <ul className="list-disc ml-5 space-y-1">
          <li>No hogging time</li>
          <li>No punching down</li>
          <li>Respect confidentiality</li>
          <li>Specific feedback &gt; vague praise</li>
        </ul>
      </section>
    </main>
  )
}
