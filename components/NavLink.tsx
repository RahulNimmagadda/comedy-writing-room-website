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
  const pathOnly = href.split("#")[0] || "/";

  // Treat "/sessions" as "Home" since it redirects to "/"
  const normalized = pathname === "/sessions" ? "/" : pathname;

  const isActive =
    pathOnly === "/"
      ? normalized === "/"
      : normalized === pathOnly || normalized.startsWith(pathOnly + "/");

  return (
    <Link
      href={href}
      className={[
        "rounded-full px-4 py-2 text-sm font-medium transition",
        isActive
          ? "bg-[#1f1510] text-[#fff6ea]"
          : "text-[#5c4d42] hover:bg-white/55 hover:text-[#1f1510]",
      ].join(" ")}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
