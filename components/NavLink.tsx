"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState("");
  const pathOnly = href.split("#")[0] || "/";
  const targetHash = href.includes("#") ? `#${href.split("#")[1]}` : "";

  // Treat "/sessions" as "Home" since it redirects to "/"
  const normalized = pathname === "/sessions" ? "/" : pathname;

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const isActive =
    targetHash.length > 0
      ? normalized === pathOnly && currentHash === targetHash
      : pathOnly === "/"
        ? normalized === "/" && currentHash === ""
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
