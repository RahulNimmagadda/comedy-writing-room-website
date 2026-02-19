import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import Link from "next/link";
import NavLink from "@/components/NavLink";
import MobileNav from "@/components/MobileNav";

export const metadata = {
  title: "Comedy Writing Room",
  description: "Daily virtual writing rooms for stand-up comedians",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/upcoming-improvements", label: "Upcoming Improvements" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-[#fbfaf7] text-zinc-900 antialiased dark:bg-[#fbfaf7] dark:text-zinc-900">
          {/* Beta banner */}
          <div className="border-b border-zinc-200/60 bg-amber-400/90">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-2 text-center text-xs font-medium text-zinc-900">
              Beta — built with the community. Feedback welcome.
            </div>
          </div>

          {/* Navigation */}
          <header className="sticky top-0 z-50 border-b border-zinc-200/60 bg-[#fbfaf7]/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
              <Link href="/" className="text-sm font-semibold tracking-tight">
                Comedy Writing Room
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden items-center gap-1 md:flex">
                <NavLink href="/">Home</NavLink>
                <NavLink href="/how-it-works">How It Works</NavLink>
                <NavLink href="/upcoming-improvements">
                  Upcoming Improvements
                </NavLink>
                <NavLink href="/about">About</NavLink>
                <NavLink href="/contact">Contact</NavLink>
              </nav>

              {/* Mobile Nav */}
              <MobileNav items={[...NAV_ITEMS]} />
            </div>
          </header>

          {/* Page content */}
          <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-zinc-200/60">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 text-sm text-zinc-500">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>Comedy Writing Room</div>
                <div className="flex items-center gap-4">
                  <Link
                    className="hover:text-zinc-700 transition"
                    href="/how-it-works"
                  >
                    How It Works
                  </Link>
                  <Link
                    className="hover:text-zinc-700 transition"
                    href="/upcoming-improvements"
                  >
                    Upcoming Improvements
                  </Link>
                  <Link className="hover:text-zinc-700 transition" href="/about">
                    About
                  </Link>
                  <Link
                    className="hover:text-zinc-700 transition"
                    href="/contact"
                  >
                    Contact
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