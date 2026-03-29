"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Item = { href: string; label: string };

export default function MobileNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [currentHash, setCurrentHash] = useState("");

  // Treat "/sessions" as "Home" since it redirects to "/"
  const normalized = pathname === "/sessions" ? "/" : pathname;

  // Close menu after route change
  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <details ref={detailsRef} className="relative z-50 md:hidden">
      <summary className="cursor-pointer list-none rounded-full border border-[#d1ba9e] bg-white/70 px-4 py-2 text-sm font-semibold text-[#1f1510] transition hover:bg-white">
        Menu
      </summary>

      <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-[1.5rem] border border-[#d8c3ad] bg-[#fbf5eb]/95 shadow-lg backdrop-blur">
        <div className="flex flex-col p-2 text-sm">
          {items.map((item) => {
            const pathOnly = item.href.split("#")[0] || "/";
            const targetHash = item.href.includes("#")
              ? `#${item.href.split("#")[1]}`
              : "";
            const isActive =
              targetHash.length > 0
                ? normalized === pathOnly && currentHash === targetHash
                : pathOnly === "/"
                  ? normalized === "/" && currentHash === ""
                  : normalized === pathOnly ||
                    normalized.startsWith(pathOnly + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "rounded-2xl px-4 py-3 transition",
                  isActive
                    ? "bg-[#1f1510] font-semibold text-[#fff6ea]"
                    : "text-[#5c4d42] hover:bg-white hover:text-[#1f1510]",
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
