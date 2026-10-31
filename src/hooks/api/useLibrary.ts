"use client";

import useSWR from "swr";
import { getLibrary, libraryKey } from "@/lib/api/library";

/** The kid player's songs. Offline, the service worker answers from the last cached list for this childId. */
export function useLibrary(childId: string | null) {
  const { data, error, isLoading } = useSWR(libraryKey(childId), getLibrary, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  return { songs: data, error: error as Error | undefined, isLoading };
}
