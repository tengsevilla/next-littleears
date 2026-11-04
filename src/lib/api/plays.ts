import { ApiClientError, apiClient } from "@/lib/api/apiClient";
import type { PlayInput, PlayItem, StatsRange, AdminStats } from "@/lib/api/types";
import { enqueuePlay, readPlayQueue, removeQueuedPlay, type QueuedPlay } from "@/lib/playQueue";

/** The API refuses queued plays older than this (400), so they are dropped instead of sent. */
const MAX_QUEUED_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** POST /api/plays. Throws ApiClientError on an HTTP error, TypeError when the network is down. */
async function postPlay(play: PlayInput): Promise<void> {
  await apiClient<null>("/api/plays", { method: "POST", body: JSON.stringify(play) });
}

/** Only a 4xx is final (bad/unknown item, rate-limited): a 5xx or no network may work later. */
const isFinal = (err: unknown) => err instanceof ApiClientError && err.status >= 400 && err.status < 500;

/**
 * Sends one counted play. Never throws: tracking must never affect playback. A play that couldn't be
 * delivered (network error or 5xx) is queued with the time it happened, for flushPlayQueue.
 */
export async function recordPlay(item: PlayItem): Promise<void> {
  const playedAt = new Date().toISOString();
  try {
    await postPlay(item);
  } catch (err) {
    if (!isFinal(err)) enqueuePlay({ ...item, playedAt });
  }
}

let flushing: Promise<void> | null = null;

/**
 * Sends queued plays oldest first, one at a time. Sent and 4xx entries leave the queue; the first network
 * error or 5xx stops the flush with the rest kept. Concurrent calls share one flush. Never throws.
 */
export function flushPlayQueue(): Promise<void> {
  flushing ??= (async () => {
    for (const entry of readPlayQueue()) {
      if (Date.now() - Date.parse(entry.playedAt) > MAX_QUEUED_AGE_MS || Number.isNaN(Date.parse(entry.playedAt))) {
        removeQueuedPlay(entry);
        continue;
      }
      try {
        await postPlay(entry);
      } catch (err) {
        if (!isFinal(err)) return;
      }
      removeQueuedPlay(entry as QueuedPlay);
    }
  })()
    .catch(() => {})
    .finally(() => {
      flushing = null;
    });
  return flushing;
}

export const STATS_RANGES: { value: StatsRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

export const statsKey = (range: StatsRange) => `/api/admin/stats?range=${range}`;

/** GET /api/admin/stats (admin only → 403 FORBIDDEN). */
export async function getAdminStats(key: string): Promise<AdminStats> {
  const { data } = await apiClient<AdminStats>(key);
  return data;
}
