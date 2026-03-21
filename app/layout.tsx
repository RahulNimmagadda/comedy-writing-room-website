import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import NavLink from "@/components/NavLink";
import MobileNav from "@/components/MobileNav";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.comedywritingroom.com"),
  title: "Comedy Writing Room",
  description: "Daily virtual writing rooms for stand-up comedians",

  icons: {
    icon: [
      { url: "/icon.png?v=3", type: "image/png" },
      { url: "/favicon.png?v=3", type: "image/png" },
    ],
    shortcut: ["/icon.png?v=3"],
    apple: ["/icon.png?v=3"],
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
        <head>
          {/* 🔥 FORCE override favicon (kills cache issues) */}
          <link rel="icon" href="/icon.png?v=3" />
          <link rel="shortcut icon" href="/icon.png?v=3" />
          <link rel="apple-touch-icon" href="/icon.png?v=3" />
        </head>

        <body className="min-h-screen bg-[#fbfaf7] text-zinc-900 antialiased dark:bg-[#fbfaf7] dark:text-zinc-900">
          <div className="border-b border-zinc-200/60 bg-amber-400/90">
            <div className="mx-auto max-w-6xl px-4 py-2 text-center text-xs font-medium text-zinc-900 sm:px-6 lg:px-8">
              Beta — built with the community. Feedback welcome.
            </div>
          </div>

          <header className="sticky top-0 z-50 border-b border-zinc-200/60 bg-[#fbfaf7]/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <Link href="/" className="text-sm font-semibold tracking-tight">
                Comedy Writing Room
              </Link>

              <nav className="hidden items-center gap-1 md:flex">
                <NavLink href="/">Home</NavLink>
                <NavLink href="/how-it-works">How It Works</NavLink>
                <NavLink href="/upcoming-improvements">
                  Upcoming Improvements
                </NavLink>
                <NavLink href="/about">About</NavLink>
                <NavLink href="/contact">Contact</NavLink>
              </nav>

              <MobileNav items={[...NAV_ITEMS]} />
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
            {children}
          </main>

          <footer className="border-t border-zinc-200/60">
            <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-zinc-500 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>Comedy Writing Room</div>
                <div className="flex items-center gap-4">
                  <Link className="transition hover:text-zinc-700" href="/how-it-works">
                    How It Works
                  </Link>
                  <Link className="transition hover:text-zinc-700" href="/upcoming-improvements">
                    Upcoming Improvements
                  </Link>
                  <Link className="transition hover:text-zinc-700" href="/about">
                    About
                  </Link>
                  <Link className="transition hover:text-zinc-700" href="/contact">
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