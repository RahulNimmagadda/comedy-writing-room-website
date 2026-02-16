import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import Link from "next/link";

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
        <body className="min-h-screen bg-black text-white antialiased">
          {/* Navigation */}
          <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
              <Link href="/" className="font-semibold text-lg tracking-tight text-white">
                Comedy Writing Room
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden items-center gap-6 text-sm text-white/80 md:flex">
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
                <Link href="/how-it-works" className="hover:text-white">
                  How It Works
                </Link>
                <Link href="/upcoming-improvements" className="hover:text-white">
                  Upcoming Improvements
                </Link>
                <Link href="/about" className="hover:text-white">
                  About Us
                </Link>
                <Link href="/contact" className="hover:text-white">
                  Contact
                </Link>
              </nav>

              {/* Mobile Nav */}
              <details className="relative md:hidden">
                <summary className="cursor-pointer list-none rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white">
                  Menu
                </summary>

                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-white/10 bg-black shadow-lg">
                  <div className="flex flex-col p-2 text-sm">
                    <Link className="rounded px-3 py-2 text-white/80 hover:bg-white/5 hover:text-white" href="/">
                      Home
                    </Link>
                    <Link className="rounded px-3 py-2 text-white/80 hover:bg-white/5 hover:text-white" href="/how-it-works">
                      How It Works
                    </Link>
                    <Link className="rounded px-3 py-2 text-white/80 hover:bg-white/5 hover:text-white" href="/upcoming-improvements">
                      Upcoming Improvements
                    </Link>
                    <Link className="rounded px-3 py-2 text-white/80 hover:bg-white/5 hover:text-white" href="/about">
                      About Us
                    </Link>
                    <Link className="rounded px-3 py-2 text-white/80 hover:bg-white/5 hover:text-white" href="/contact">
                      Contact
                    </Link>
                  </div>
                </div>
              </details>
            </div>
          </header>

          {/* IMPORTANT: don’t add a second wrapper here — pages control their own background */}
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
