import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import NavLink from "@/components/NavLink";
import MobileNav from "@/components/MobileNav";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.comedywritingroom.com"),
  title: "Comedy Writing Room",
  description: "Daily virtual writing rooms for stand-up comedians",
  icons: {
    icon: [{ url: "/favicon.avif?v=5", type: "image/avif" }],
    shortcut: ["/favicon.avif?v=5"],
    apple: ["/favicon.avif?v=5"],
  },
  openGraph: {
    title: "Comedy Writing Room",
    description: "Daily virtual writing rooms for stand-up comedians",
    url: "https://www.comedywritingroom.com",
    siteName: "Comedy Writing Room",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Comedy Writing Room",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Comedy Writing Room",
    description: "Daily virtual writing rooms for stand-up comedians",
    images: ["/og-image.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/upcoming-improvements", label: "Upcoming Improvements" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  const isAdmin =
    !!userId &&
    (process.env.ADMIN_USER_IDS?.split(",")
      .map((s) => s.trim())
      .includes(userId) ??
      false);

  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="icon" href="/favicon.avif?v=5" type="image/avif" />
          <link rel="shortcut icon" href="/favicon.avif?v=5" />
          <link rel="apple-touch-icon" href="/favicon.avif?v=5" />
        </head>
        <body className="min-h-screen text-zinc-900 antialiased">
          <div className="border-b border-[#d8c3ad]/80 bg-[#f0c27a]/70">
            <div className="mx-auto max-w-7xl px-4 py-2 text-center text-xs font-medium uppercase tracking-[0.2em] text-[#1f1510] sm:px-6 lg:px-8">
              Beta • built with the community • feedback welcome
            </div>
          </div>

          <header className="sticky top-0 z-50 bg-transparent">
            <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between rounded-full border border-[#d1ba9e] bg-[#fbf5eb]/88 px-5 py-4 shadow-[0_20px_50px_rgba(58,36,23,0.08)] backdrop-blur">
                <Link
                  href="/"
                  className="font-serif text-xl font-semibold tracking-tight text-[#1f1510] sm:text-2xl"
                >
                  Comedy Writing Room
                </Link>

                <nav className="hidden items-center gap-1 md:flex">
                  <NavLink href="/">Home</NavLink>
                  <NavLink href="/#how-it-works">How It Works</NavLink>
                  <NavLink href="/upcoming-improvements">
                    Upcoming Improvements
                  </NavLink>
                  <NavLink href="/about">About</NavLink>
                  <NavLink href="/contact">Contact</NavLink>
                  {isAdmin && <NavLink href="/admin/sessions">Admin</NavLink>}
                </nav>

                <div className="flex items-center gap-3">
                  <Link
                    href={userId ? "/account" : "/sign-in"}
                    className="hidden rounded-full bg-[#1f1510] px-5 py-2.5 text-sm font-semibold text-[#fff6ea] transition hover:bg-[#31231b] md:inline-flex"
                  >
                    {userId ? "Account" : "Sign in"}
                  </Link>
                  <MobileNav
                    items={[
                      ...NAV_ITEMS,
                      {
                        href: userId ? "/account" : "/sign-in",
                        label: userId ? "Account" : "Sign in",
                      },
                      ...(isAdmin
                        ? [{ href: "/admin/sessions", label: "Admin" }]
                        : []),
                    ]}
                  />
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 sm:pb-16 sm:pt-8 lg:px-8">
            {children}
          </main>

          <footer className="border-t border-[#d8c3ad]/90">
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-6 rounded-[2rem] border border-[#d8c3ad] bg-[#fbf5eb]/85 px-6 py-8 shadow-[0_24px_60px_rgba(58,36,23,0.08)] sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-xl">
                  <div className="font-serif text-2xl font-semibold text-[#1f1510]">
                    Comedy Writing Room
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#5d4e43]">
                    Daily virtual writing rooms for comics who want more reps,
                    sharper material, and better feedback.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-[#5d4e43]">
                  <Link
                    className="transition hover:text-[#1f1510]"
                    href="/#how-it-works"
                  >
                    How It Works
                  </Link>
                  <Link
                    className="transition hover:text-[#1f1510]"
                    href="/upcoming-improvements"
                  >
                    Upcoming Improvements
                  </Link>
                  <Link
                    className="transition hover:text-[#1f1510]"
                    href="/about"
                  >
                    About
                  </Link>
                  <Link
                    className="transition hover:text-[#1f1510]"
                    href="/contact"
                  >
                    Contact
                  </Link>
                </div>
              </div>
            </div>
          </footer>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
