"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Treat "/sessions" as "Home" since it redirects to "/"
  const normalized = pathname === "/sessions" ? "/" : pathname;

  const isActive =
    href === "/"
      ? normalized === "/"
      : normalized === href || normalized.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={[
        "rounded-lg px-2 py-1 text-sm transition",
        isActive
          ? "bg-amber-400/90 text-zinc-900"
          : "text-zinc-600 hover:text-zinc-900 hover:bg-white/60",
      ].join(" ")}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
