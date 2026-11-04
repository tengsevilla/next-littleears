"use client";

import { useEffect, useState } from "react";
import { flushPlayQueue, recordPlay } from "@/lib/api/plays";
import type { PlayItem } from "@/lib/api/types";

/** A play counts once this much playback has accumulated (CLAUDE.md "Play tracking"). */
export const PLAY_COUNT_MS = 10_000;

/**
 * Counts plays for the kid player. One tracker is shared by the song and sound players (only one thing plays
 * at a time), and the players drive it from their own events:
 *
 * - `play(item)`: audio is actually playing. A different item than the current count starts a new count.
 * - `pause()`: playback stopped for now (pause, buffering); the count keeps what it has.
 * - `restart()`: a new play of whatever is playing (same song restarted, next song in "play all"); the count
 *   starts again from zero and keeps running if audio is.
 * - `stop()`: the play is over (ended, tapped off, unmounted); the next `play` starts a new count.
 *
 * Each count sends at most one POST /api/plays, after PLAY_COUNT_MS of playback. Sending is fire-and-forget
 * and never throws, so tracking can't affect playback.
 */
export type PlayTracker = {
  play: (item: PlayItem) => void;
  pause: () => void;
  restart: () => void;
  stop: () => void;
};

const itemKey = (item: PlayItem) => ("songId" in item ? `song:${item.songId}` : `sound:${item.soundSlug}`);

function createPlayTracker(): PlayTracker {
  let count: { key: string; item: PlayItem; playedMs: number; sent: boolean } | null = null;
  let runningSince: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const halt = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (count && runningSince !== null) count.playedMs += performance.now() - runningSince;
    runningSince = null;
  };

  const run = () => {
    if (!count || count.sent) return;
    runningSince = performance.now();
    const current = count;
    timer = setTimeout(() => {
      timer = null;
      current.sent = true;
      void recordPlay(current.item);
    }, Math.max(0, PLAY_COUNT_MS - current.playedMs));
  };

  return {
    play(item) {
      const key = itemKey(item);
      if (count?.key === key && runningSince !== null) return;
      halt();
      if (count?.key !== key) count = { key, item, playedMs: 0, sent: false };
      run();
    },
    pause: halt,
    restart() {
      const wasRunning = runningSince !== null;
      halt();
      if (!count) return;
      count = { ...count, playedMs: 0, sent: false };
      if (wasRunning) run();
    },
    stop() {
      halt();
      count = null;
    },
  };
}

/**
 * The player's tracker. Mounting the player also sends any plays queued while offline, and so does the
 * device coming back online.
 */
export function usePlayTracker(): PlayTracker {
  const [tracker] = useState(createPlayTracker);

  useEffect(() => {
    void flushPlayQueue();
    const onOnline = () => void flushPlayQueue();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      tracker.stop();
    };
  }, [tracker]);

  return tracker;
}
