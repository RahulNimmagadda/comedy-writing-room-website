"use client";

import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";
import PayButton from "@/components/PayButton";
import TimezoneField from "@/components/TimezoneField";
import { joinSession, type JoinSessionResult } from "@/app/sessions/actions";
import { getSessionTiming } from "@/lib/sessionTiming";

function subscribeNow(callback: () => void) {
  const interval = setInterval(callback, 15_000);
  return () => clearInterval(interval);
}

function getNowSnapshot() {
  return Date.now();
}

function getServerNowSnapshot() {
  return 0;
}

async function joinSessionAction(
  _state: JoinSessionResult | null,
  formData: FormData
): Promise<JoinSessionResult> {
  return joinSession(formData);
}

type Variant = "hero" | "list";

const baseButtonClasses =
  "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold whitespace-nowrap transition";

const stylesByVariant: Record<
  Variant,
  {
    primary: string;
    disabled: string;
  }
> = {
  hero: {
    primary:
      "bg-[#1f1510] text-[#fff8ed] hover:bg-[#31231b] shadow-[0_18px_45px_rgba(26,18,13,0.18)]",
    disabled: "cursor-default bg-[#e6ddd2] text-[#6d5a4e]",
  },
  list: {
    primary: "bg-[#1f1510] text-[#fff8ed] hover:bg-[#31231b]",
    disabled: "cursor-default bg-[#ebe3d8] text-[#6d5a4e]",
  },
};

export default function SessionActionButton({
  sessionId,
  startsAt,
  durationMinutes,
  priceCents,
  userId,
  isJoined,
  isAdmin,
  variant = "list",
}: {
  sessionId: string;
  startsAt: string;
  durationMinutes: number;
  priceCents: number;
  userId?: string | null;
  isJoined?: boolean;
  isAdmin?: boolean;
  variant?: Variant;
}) {
  const [state, formAction] = useActionState(joinSessionAction, null);
  const nowMs = useSyncExternalStore(
    subscribeNow,
    getNowSnapshot,
    getServerNowSnapshot
  );

  const { endMs, joinOpensAtMs, joinClosesAtMs } = getSessionTiming(
    startsAt,
    durationMinutes
  );
  const hasLiveNow = nowMs > 0;
  const isJoinWindowClosed =
    hasLiveNow && nowMs > joinClosesAtMs && nowMs <= endMs;
  const canJoinNow =
    hasLiveNow &&
    !!isJoined &&
    nowMs >= joinOpensAtMs &&
    nowMs <= joinClosesAtMs;
  const canReserveNow = !hasLiveNow || nowMs <= joinClosesAtMs;
  const isFree = (priceCents ?? 0) <= 0;
  const canReserveDirectly = isFree || !!isAdmin;
  const variantStyles = stylesByVariant[variant];

  return (
    <div className="space-y-2">
      {isJoinWindowClosed ? (
        <button
          type="button"
          disabled
          className={`${baseButtonClasses} ${variantStyles.disabled}`}
        >
          Join window closed
        </button>
      ) : canJoinNow ? (
        <Link
          href={`/sessions/${sessionId}/join`}
          className={`${baseButtonClasses} ${variantStyles.primary}`}
        >
          Join Room
        </Link>
      ) : !userId ? (
        <Link
          href="/sign-in"
          className={`${baseButtonClasses} ${variantStyles.primary}`}
        >
          Sign in to reserve
        </Link>
      ) : isJoined ? (
        <button
          type="button"
          disabled
          className={`${baseButtonClasses} ${variantStyles.disabled}`}
        >
          Reserved
        </button>
      ) : !canReserveNow ? (
        <button
          type="button"
          disabled
          className={`${baseButtonClasses} ${variantStyles.disabled}`}
        >
          Join window closed
        </button>
      ) : canReserveDirectly ? (
        <form action={formAction}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <TimezoneField />
          <button
            className={`${baseButtonClasses} ${variantStyles.primary}`}
            type="submit"
          >
            {isFree
              ? "Reserve spot (Free)"
              : isAdmin
                ? "Reserve spot (Admin free)"
                : "Reserve"}
          </button>
        </form>
      ) : (
        <PayButton
          sessionId={sessionId}
          priceCents={priceCents}
          className={`${baseButtonClasses} ${variantStyles.primary}`}
        />
      )}

      {state && !state.ok && (
        <div className="max-w-72 text-sm text-red-700">{state.error}</div>
      )}
    </div>
  );
}
