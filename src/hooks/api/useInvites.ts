"use client";

import useSWR from "swr";
import { INVITES_KEY, listInvites } from "@/lib/api/invites";

/** Admin invite list. `enabled: false` (a parent) makes no request — the API would answer 403. */
export function useInvites(enabled: boolean) {
  const { data, error, isLoading, mutate } = useSWR(enabled ? INVITES_KEY : null, listInvites);
  return { invites: data, error: error as Error | undefined, isLoading, mutate };
}
