export default function ContactPage() {
  return (
    <div className="space-y-10 pb-8 sm:space-y-14">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-[#d8c3ad] bg-[linear-gradient(135deg,#201611_0%,#2e1e16_100%)] px-6 py-10 text-[#f8f1e8] shadow-[0_28px_90px_rgba(45,28,18,0.18)] sm:px-10 sm:py-14">
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(circle_at_bottom,rgba(201,85,46,0.14),transparent_58%)]" />
        <div className="relative max-w-3xl">
          <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#f1c27b]">
            Contact
          </div>
          <h1 className="mt-4 font-serif text-5xl font-semibold tracking-tight text-[#f8f1e8] sm:text-6xl">
            Reach out anytime.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#d4c3b3]">
            Questions, feedback, or interested in hosting a writing room? I&apos;d
            love to hear from you.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-[2rem] border border-[#d8c3ad] bg-[#fbf5eb]/88 px-6 py-7 shadow-[0_24px_60px_rgba(58,36,23,0.08)] sm:px-8 sm:py-9">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#b5532e]">
            Email
          </div>
          <a
            href="mailto:hello@comedywritingroom.com"
            className="mt-4 block font-serif text-4xl font-semibold tracking-tight text-[#1d140f] transition hover:text-[#b5532e] sm:text-5xl"
          >
            hello@comedywritingroom.com
          </a>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#5e5045]">
            Questions, ideas, bugs, feedback, or interest in hosting are all
            welcome.
          </p>
        </div>

        <div className="rounded-[2rem] border border-[#d8c3ad] bg-[linear-gradient(180deg,#fff8ef_0%,#f4e7d8_100%)] px-6 py-7 shadow-[0_24px_60px_rgba(58,36,23,0.08)]">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#9c6b44]">
            Best For
          </div>
          <ul className="mt-5 space-y-4 text-base leading-relaxed text-[#4f4339]">
            <li>Session feedback</li>
            <li>Hosting ideas</li>
            <li>Bug reports</li>
            <li>Community suggestions</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
