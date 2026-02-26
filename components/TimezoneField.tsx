"use client";

import { useEffect, useState } from "react";

export default function TimezoneField({
  name = "timezone",
}: {
  name?: string;
}) {
  const [tz, setTz] = useState<string>("");

  useEffect(() => {
    try {
      const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (z) setTz(z);
    } catch {
      // ignore
    }
  }, []);

  return <input type="hidden" name={name} value={tz} />;
}