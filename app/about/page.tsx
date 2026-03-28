export default function AboutPage() {
  return (
    <div className="space-y-10 pb-8 sm:space-y-14">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-[#d8c3ad] bg-[linear-gradient(135deg,#fbf4ea_0%,#f1e3d3_52%,#ead7c3_100%)] px-6 py-10 shadow-[0_28px_90px_rgba(58,36,23,0.08)] sm:px-10 sm:py-14">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(240,194,122,0.18),transparent_62%)]" />
        <div className="relative max-w-3xl">
          <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#9c6b44]">
            About
          </div>
          <h1 className="mt-4 max-w-3xl font-serif text-5xl font-semibold tracking-tight text-[#1d140f] sm:text-6xl">
            Built from a real comedy room.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#5e5045]">
            A simple idea: make the kind of virtual writing room that actually
            helps comics improve, connect, and keep showing up.
          </p>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_320px] lg:gap-12">
        <div className="rounded-[2rem] border border-[#d8c3ad] bg-[#fbf5eb]/88 px-6 py-7 shadow-[0_24px_60px_rgba(58,36,23,0.08)] sm:px-8 sm:py-9">
          <div className="max-w-2xl space-y-6 text-lg leading-relaxed text-[#4f4339]">
            <p>
              My friends and I get together virtually most weekends to do a
              comedy writer&apos;s room. It&apos;s been incredibly helpful to me
              and I wanted all comics to have the same opportunity to improve
              and connect.
            </p>

            <p>
              This site is still in its early stages and will grow and change
              frequently in the coming days. If you have any feedback, please
              feel free to contact me!
            </p>
          </div>
        </div>

        <aside className="rounded-[2rem] border border-[#d8c3ad] bg-[linear-gradient(180deg,#fff8ef_0%,#f4e7d8_100%)] px-6 py-7 shadow-[0_24px_60px_rgba(58,36,23,0.08)]">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#b5532e]">
            Contact
          </div>
          <p className="mt-4 break-words font-serif text-3xl font-semibold text-[#1d140f]">
            hello@comedywritingroom.com
          </p>
          <p className="mt-4 text-base leading-relaxed text-[#5e5045]">
            Questions, feedback, bugs, ideas, or just saying hi are all
            welcome.
          </p>
          <a
            href="mailto:hello@comedywritingroom.com"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#1f1510] px-5 py-3 text-sm font-semibold text-[#fff6ea] transition hover:bg-[#31231b]"
          >
            Email Comedy Writing Room
          </a>
        </aside>
      </section>
    </div>
  );
}
