export const JOIN_EARLY_ACCESS_MS = 5 * 60_000;
export const LATE_JOIN_GRACE_MS = 5 * 60_000;

export function getSessionTiming(
  startsAtIso: string,
  durationMinutes: number
) {
  const startMs = new Date(startsAtIso).getTime();
  const endMs = startMs + durationMinutes * 60_000;

  return {
    startMs,
    endMs,
    joinOpensAtMs: startMs - JOIN_EARLY_ACCESS_MS,
    joinClosesAtMs: startMs + LATE_JOIN_GRACE_MS,
  };
}

export type SessionPhase =
  | "before-open"
  | "join-open"
  | "grace-period"
  | "late-locked"
  | "ended";

export function getSessionPhase(
  nowMs: number,
  startsAtIso: string,
  durationMinutes: number
): SessionPhase {
  const { startMs, endMs, joinOpensAtMs, joinClosesAtMs } = getSessionTiming(
    startsAtIso,
    durationMinutes
  );

  if (nowMs < joinOpensAtMs) return "before-open";
  if (nowMs < startMs) return "join-open";
  if (nowMs <= joinClosesAtMs) return "grace-period";
  if (nowMs <= endMs) return "late-locked";
  return "ended";
}
