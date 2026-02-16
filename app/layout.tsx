import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import Link from "next/link";

export const metadata = {
  title: "Comedy Writing Room",
  description: "Daily virtual writing rooms for stand-up comedians",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-gray-50 text-gray-900">
          <nav className="border-b bg-white">
            <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
              <Link href="/" className="font-semibold text-lg">
                Comedy Writing Room
              </Link>

              <div className="flex gap-6 text-sm">
                <Link href="/" className="hover:underline">
                  Home
                </Link>

                <Link href="/how-it-works" className="hover:underline">
                  How It Works
                </Link>

                <Link href="/about" className="hover:underline">
                  About Us
                </Link>

                <Link href="/contact" className="hover:underline">
                  Contact
                </Link>
              </div>
            </div>
          </nav>

          <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
