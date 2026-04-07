"use client";

import Link from "next/link";
import { ReactNode, useSyncExternalStore } from "react";
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

export default function JoinRoomGate({
  title,
  startsAt,
  durationMinutes,
  children,
}: {
  title: string;
  startsAt: string;
  durationMinutes: number;
  children: ReactNode;
}) {
  const now = useSyncExternalStore(
    subscribeNow,
    getNowSnapshot,
    getServerNowSnapshot
  );

  if (now === 0) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="opacity-70">Checking session status…</p>
        <Link className="underline" href="/">
          Back to sessions
        </Link>
      </main>
    );
  }

  const { joinOpensAtMs, joinClosesAtMs, endMs } = getSessionTiming(
    startsAt,
    durationMinutes
  );

  if (now < joinOpensAtMs) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Room not open yet</h1>
        <p className="opacity-70">
          Join Room becomes available 5 minutes before the session starts. Late
          entry closes 5 minutes after start so the room can begin without
          interruptions.
        </p>
        <Link className="underline" href="/">
          Back to sessions
        </Link>
      </main>
    );
  }

  if (now > joinClosesAtMs && now <= endMs) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Late entry is closed</h1>
        <p className="opacity-70">
          This session is already in progress. Joining is only available
          through 5 minutes after the session starts so the room stays focused.
        </p>
        <Link className="underline" href="/">
          Back to sessions
        </Link>
      </main>
    );
  }

  if (now > endMs) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-2xl font-bold">Session Ended</h1>
        <p className="opacity-70">This session has already ended.</p>
        <Link className="underline" href="/">
          Back to sessions
        </Link>
      </main>
    );
  }

  return <>{children}</>;
}
