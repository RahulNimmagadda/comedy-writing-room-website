import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import Link from "next/link";
import NavLink from "@/components/NavLink";

export const metadata = {
  title: "Comedy Writing Room",
  description: "Daily virtual writing rooms for stand-up comedians",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-[#fbfaf7] text-zinc-900 antialiased">
          {/* Beta banner */}
          <div className="border-b border-zinc-200/60 bg-amber-400/90">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-2 text-center text-xs font-medium text-zinc-900">
              Beta — built with the community. Feedback welcome.
            </div>
          </div>

          {/* Navigation */}
          <header className="sticky top-0 z-50 border-b border-zinc-200/60 bg-[#fbfaf7]/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
              <Link href="/" className="text-sm font-semibold tracking-tight">
                Comedy Writing Room
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden items-center gap-1 md:flex">
                <NavLink href="/">Home</NavLink>
                <NavLink href="/sessions">Sessions</NavLink>
                <NavLink href="/how-it-works">How It Works</NavLink>
                <NavLink href="/upcoming-improvements">Upcoming</NavLink>
                <NavLink href="/about">About</NavLink>
                <NavLink href="/contact">Contact</NavLink>
              </nav>

              {/* Mobile Nav */}
              <details className="relative md:hidden">
                <summary className="cursor-pointer list-none rounded-xl border border-zinc-300 bg-white/60 px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-white transition">
                  Menu
                </summary>

                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/90 shadow-lg backdrop-blur">
                  <div className="flex flex-col p-2 text-sm">
                    <Link
                      className="rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition"
                      href="/"
                    >
                      Home
                    </Link>
                    <Link
                      className="rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition"
                      href="/sessions"
                    >
                      Sessions
                    </Link>
                    <Link
                      className="rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition"
                      href="/how-it-works"
                    >
                      How It Works
                    </Link>
                    <Link
                      className="rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition"
                      href="/upcoming-improvements"
                    >
                      Upcoming
                    </Link>
                    <Link
                      className="rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition"
                      href="/about"
                    >
                      About
                    </Link>
                    <Link
                      className="rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition"
                      href="/contact"
                    >
                      Contact
                    </Link>
                  </div>
                </div>
              </details>
            </div>
          </header>

          {/* Page content */}
          <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-zinc-200/60">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 text-sm text-zinc-500">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>Comedy Writing Room</div>
                <div className="flex items-center gap-4">
                  <Link className="hover:text-zinc-700 transition" href="/sessions">
                    Sessions
                  </Link>
                  <Link className="hover:text-zinc-700 transition" href="/how-it-works">
                    How It Works
                  </Link>
                  <Link
                    className="hover:text-zinc-700 transition"
                    href="/upcoming-improvements"
                  >
                    Upcoming
                  </Link>
                </div>
              </div>
            </div>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
