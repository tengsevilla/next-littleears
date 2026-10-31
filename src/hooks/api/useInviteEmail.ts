"use client";

import useSWRImmutable from "swr/immutable";
import { getInviteEmail } from "@/lib/api/invites";

/** The email an invite link was made for (checked once, never retried). `token === null` makes no request. */
export function useInviteEmail(token: string | null) {
  const { data, error, isLoading } = useSWRImmutable(token ? ["invite", token] : null, ([, t]: [string, string]) =>
    getInviteEmail(t),
    { shouldRetryOnError: false },
  );
  return { email: data, error: error as Error | undefined, isLoading };
}
