"use client";

import useSWR from "swr";
import { getAdminStats, statsKey } from "@/lib/api/plays";
import type { StatsRange } from "@/lib/api/types";

/**
 * Admin play stats for one range. The key carries the range, so switching refetches; the previous range stays
 * on screen meanwhile. `enabled: false` (a parent) makes no request — the API would answer 403.
 */
export function useAdminStats(range: StatsRange, enabled: boolean) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(enabled ? statsKey(range) : null, getAdminStats, {
    keepPreviousData: true,
  });
  return { stats: data, error: error as Error | undefined, isLoading, isValidating, mutate };
}
