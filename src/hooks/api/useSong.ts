"use client";

import useSWR, { useSWRConfig } from "swr";
import { getSong, isInProgress, POLL_MS, songKey } from "@/lib/api/songs";
import type { Song } from "@/lib/api/types";

/** One song; polls every 3 s while non-terminal and resumes when a mutation puts it back in the queue. */
export function useSong(id: string) {
  const key = songKey(id);
  // SWR only re-reads refreshInterval when the option itself changes, so derive it from the cached data each render.
  const { cache } = useSWRConfig();
  const cached = cache.get(key)?.data as Song | undefined;
  const polling = !!cached && isInProgress(cached.status);

  const { data, error, isLoading, mutate } = useSWR(key, () => getSong(id), {
    refreshInterval: polling ? POLL_MS : 0,
  });
  return { song: data, error: error as Error | undefined, isLoading, mutate };
}
