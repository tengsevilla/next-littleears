"use client";

import useSWR, { useSWRConfig } from "swr";
import { isInProgress, listSongs, POLL_MS, songsKey } from "@/lib/api/songs";
import type { SongStatus, SongSummary } from "@/lib/api/types";

/** Song list, optionally filtered server-side; polls every 3 s while any listed song is still being made. */
export function useSongs(status?: SongStatus) {
  const key = songsKey(status);
  // SWR only re-reads refreshInterval when the option itself changes, so derive it from the cached data each render.
  const { cache } = useSWRConfig();
  const cached = cache.get(key)?.data as SongSummary[] | undefined;
  const polling = !!cached?.some((s) => isInProgress(s.status));

  const { data, error, isLoading, mutate } = useSWR(key, () => listSongs(status), {
    refreshInterval: polling ? POLL_MS : 0,
  });
  return { songs: data, error: error as Error | undefined, isLoading, mutate };
}
