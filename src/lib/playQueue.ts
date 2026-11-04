import { z } from "zod";
import type { PlayInput } from "@/lib/api/types";

// Plays counted while the device was offline, waiting to be sent (CLAUDE.md "Play tracking").
// Not secret (an item id and a time), but it is this account's listening history, so logout clears it.
// Storage can throw (private mode, blocked site data): every access is guarded, and a lost entry only
// means one uncounted play.
const KEY = "littleears.plays.queue";
export const PLAY_QUEUE_MAX = 200;

const entrySchema = z.union([
  z.object({ songId: z.string().min(1), playedAt: z.string() }),
  z.object({ soundSlug: z.string().min(1), playedAt: z.string() }),
]);
export type QueuedPlay = PlayInput & { playedAt: string };

export function readPlayQueue(): QueuedPlay[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = z.array(entrySchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function write(entries: QueuedPlay[]): void {
  try {
    if (entries.length) window.localStorage.setItem(KEY, JSON.stringify(entries.slice(-PLAY_QUEUE_MAX)));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Not persisted; that play just isn't counted.
  }
}

/** Appends a play, dropping the oldest past PLAY_QUEUE_MAX. */
export function enqueuePlay(entry: QueuedPlay): void {
  write([...readPlayQueue(), entry]);
}

/** Removes one sent (or rejected) entry; matched by value, since a flush can overlap a new enqueue. */
export function removeQueuedPlay(entry: QueuedPlay): void {
  const entries = readPlayQueue();
  const i = entries.findIndex(
    (e) => e.playedAt === entry.playedAt && ("songId" in e ? "songId" in entry && e.songId === entry.songId : "soundSlug" in entry && e.soundSlug === entry.soundSlug),
  );
  if (i >= 0) write([...entries.slice(0, i), ...entries.slice(i + 1)]);
}

/** Called on logout: the next account on this device must not inherit this one's plays. */
export function clearPlayQueue(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
