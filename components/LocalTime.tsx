"use client";

import * as React from "react";

type Props = {
  iso: string; // UTC ISO from DB, e.g. "2026-02-19T01:00:00.000Z"
  options?: Intl.DateTimeFormatOptions;
  locale?: string; // optional override, otherwise uses browser default
  placeholder?: string;
};

export default function LocalTime({
  iso,
  options,
  locale,
  placeholder = "—",
}: Props) {
  const [text, setText] = React.useState<string>(placeholder);

  React.useEffect(() => {
    try {
      const d = new Date(iso);

      // If iso is invalid, this becomes "Invalid Date"
      if (Number.isNaN(d.getTime())) {
        setText(placeholder);
        return;
      }

      const fmt = new Intl.DateTimeFormat(locale || undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        ...options,
      });

      setText(fmt.format(d));
    } catch {
      setText(placeholder);
    }
  }, [iso, locale, options, placeholder]);

  return <span suppressHydrationWarning>{text}</span>;
}
