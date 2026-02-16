// lib/datetime.ts

// UTC ISO (e.g. "2026-02-15T20:30:00.000Z")
// -> "YYYY-MM-DDTHH:mm" in the user's LOCAL time
export function utcIsoToDatetimeLocal(utcIso: string) {
  const d = new Date(utcIso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// "YYYY-MM-DDTHH:mm" (LOCAL time)
// -> UTC ISO string
export function datetimeLocalToUtcIso(localValue: string) {
  return new Date(localValue).toISOString();
}
