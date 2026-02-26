"use client";

export default function TimezoneField({
  name = "timezone",
}: {
  name?: string;
}) {
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    tz = "";
  }

  return <input type="hidden" name={name} value={tz} />;
}