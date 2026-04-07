"use client";

import { useSyncExternalStore } from "react";
import { getSessionPhase } from "@/lib/sessionTiming";

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

export default function SessionTimingNotice({
  startsAt,
  durationMinutes,
  isJoined = false,
  tone = "default",
}: {
  startsAt: string;
  durationMinutes: number;
  isJoined?: boolean;
  tone?: "default" | "hero";
}) {
  const nowMs = useSyncExternalStore(
    subscribeNow,
    getNowSnapshot,
    getServerNowSnapshot
  );

  const phase =
    nowMs > 0
      ? getSessionPhase(nowMs, startsAt, durationMinutes)
      : "before-open";

  const palette =
    tone === "hero"
      ? {
          shell: "border-[#e2d1bc] bg-white/45",
          eyebrow: "text-[#8c6a50]",
          title: "text-[#1f1510]",
          body: "text-[#5d4e43]",
        }
      : {
          shell: "border-[#ead9c5] bg-[#fffaf4]",
          eyebrow: "text-[#9a6e4f]",
          title: "text-[#2d1d14]",
          body: "text-[#6b5648]",
        };

  const copyByPhase = {
    "before-open": {
      eyebrow: isJoined ? "Arrival policy" : "Before you book",
      title: "Join opens 5 minutes before start",
      body: isJoined
        ? "Please plan to be on time. To protect the room's flow, late entry closes 5 minutes after the session starts."
        : "Please plan to arrive on time. Booked comics can enter from 5 minutes before start until 5 minutes after start.",
    },
    "join-open": {
      eyebrow: isJoined ? "Join window open" : "Starting soon",
      title: isJoined ? "You can head in now" : "Join window is now open",
      body: isJoined
        ? "You're inside the early access window. Late entry still locks 5 minutes after start so the room can get moving."
        : "Booked comics can join now. Late entry locks 5 minutes after start so the room is not disrupted.",
    },
    "grace-period": {
      eyebrow: "Session just started",
      title: isJoined ? "Join now if you're coming in" : "Doors lock very soon",
      body: isJoined
        ? "The room is live, and late entry closes 5 minutes after start to avoid interruptions."
        : "This session is already underway. We stop late entry 5 minutes after start to protect the room's momentum.",
    },
    "late-locked": {
      eyebrow: "Session in progress",
      title: "Late entry is closed",
      body: "This room is already underway, and joining is locked 5 minutes after start so the group can stay focused.",
    },
    ended: {
      eyebrow: "Session ended",
      title: "This room has wrapped",
      body: "This session has already ended.",
    },
  } as const;

  const copy = copyByPhase[phase];

  return (
    <div className={`rounded-[1.2rem] border px-4 py-3 ${palette.shell}`}>
      <div
        className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${palette.eyebrow}`}
      >
        {copy.eyebrow}
      </div>
      <div className={`mt-1 text-sm font-semibold ${palette.title}`}>
        {copy.title}
      </div>
      <div className={`mt-1 text-sm leading-relaxed ${palette.body}`}>
        {copy.body}
      </div>
    </div>
  );
}
