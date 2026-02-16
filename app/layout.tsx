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
        <body className="min-h-screen bg-white text-gray-900 antialiased">
          {/* Navigation */}
          <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
              <Link href="/" className="font-semibold text-lg tracking-tight">
                Comedy Writing Room
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden items-center gap-6 text-sm md:flex">
                <Link href="/" className="hover:underline">
                  Home
                </Link>
                <Link href="/how-it-works" className="hover:underline">
                  How It Works
                </Link>
                <Link href="/upcoming-improvements" className="hover:underline">
                  Upcoming Improvements
                </Link>
                <Link href="/about" className="hover:underline">
                  About Us
                </Link>
                <Link href="/contact" className="hover:underline">
                  Contact
                </Link>
              </nav>

              {/* Mobile Nav */}
              <details className="relative md:hidden">
                <summary className="cursor-pointer list-none rounded-md border px-3 py-2 text-sm">
                  Menu
                </summary>

                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border bg-white shadow-lg">
                  <div className="flex flex-col p-2 text-sm">
                    <Link className="rounded px-3 py-2 hover:bg-gray-100" href="/">
                      Home
                    </Link>
                    <Link className="rounded px-3 py-2 hover:bg-gray-100" href="/how-it-works">
                      How It Works
                    </Link>
                    <Link className="rounded px-3 py-2 hover:bg-gray-100" href="/upcoming-improvements">
                      Upcoming Improvements
                    </Link>
                    <Link className="rounded px-3 py-2 hover:bg-gray-100" href="/about">
                      About Us
                    </Link>
                    <Link className="rounded px-3 py-2 hover:bg-gray-100" href="/contact">
                      Contact
                    </Link>
                  </div>
                </div>
              </details>
            </div>
          </header>

          {/* Main Content Wrapper */}
          <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
