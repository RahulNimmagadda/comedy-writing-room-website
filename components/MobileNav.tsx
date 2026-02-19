"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type Item = { href: string; label: string };

export default function MobileNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLElement | null>(null);

  // Treat "/sessions" as "Home" since it redirects to "/"
  const normalized = pathname === "/sessions" ? "/" : pathname;

  // Close menu after route change
  useEffect(() => {
    const el = detailsRef.current as HTMLDetailsElement | null;
    if (el) el.open = false;
  }, [pathname]);

  return (
    <details ref={detailsRef as any} className="relative md:hidden">
      <summary className="cursor-pointer list-none rounded-xl border border-zinc-300 bg-white/60 px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-white transition">
        Menu
      </summary>

      <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/90 shadow-lg backdrop-blur">
        <div className="flex flex-col p-2 text-sm">
          {items.map((item) => {
            const isActive =
              item.href === "/"
                ? normalized === "/"
                : normalized === item.href || normalized.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "rounded-xl px-3 py-2 transition",
                  isActive
                    ? "bg-amber-400/90 text-zinc-900 font-semibold"
                    : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </details>
  );
}
