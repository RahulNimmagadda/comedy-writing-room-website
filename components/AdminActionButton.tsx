"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

type Variant = "primary" | "danger";

function variantClasses(variant: Variant) {
  if (variant === "danger") {
    return "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200";
  }

  return "bg-black text-white hover:bg-zinc-800 active:bg-zinc-950";
}

export default function AdminActionButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel: string;
  variant?: Variant;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      disabled={pending || props.disabled}
      aria-busy={pending}
      className={`inline-flex cursor-pointer items-center justify-center rounded px-4 py-2 font-medium transition focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses(
        variant
      )} ${className}`.trim()}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
