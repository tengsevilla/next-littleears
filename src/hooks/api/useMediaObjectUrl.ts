"use client";

import { useEffect, useState } from "react";
import useSWRImmutable from "swr/immutable";
import { apiBlob } from "@/lib/api/apiClient";

/**
 * Authenticated media for <audio>/<img>, which can't send the in-memory bearer token.
 *
 * - The Blob is fetched through apiBlob (same token + refresh path as apiClient) and cached by SWR under the
 *   full URL. Media URLs carry `?v=<hash of the S3 key>` and are immutable, so a URL is fetched once per
 *   session no matter how many components show it; a regenerated part arrives as a new URL.
 * - Each consumer turns the shared Blob into its own object URL and revokes it on unmount or URL change,
 *   so one component unmounting can never break another's playback.
 * - `url === null` (no media yet) makes no request.
 */
export function useMediaObjectUrl(url: string | null) {
  const { data: blob, error } = useSWRImmutable(url ? ["media", url] : null, ([, u]: [string, string]) => apiBlob(u), {
    shouldRetryOnError: false,
  });
  const [entry, setEntry] = useState<{ blob: Blob; objectUrl: string } | null>(null);

  useEffect(() => {
    if (!blob) return;
    // The object URL is an external resource owned by this effect: created here, revoked in the cleanup.
    // Creating it during render instead would leave StrictMode's remount holding a revoked URL.
    const objectUrl = URL.createObjectURL(blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- publishes the resource this effect just created
    setEntry({ blob, objectUrl });
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  // Only hand out the object URL that belongs to the current Blob — never a revoked or stale one.
  const objectUrl = blob && entry?.blob === blob ? entry.objectUrl : null;
  return { objectUrl, error: error as Error | undefined, isLoading: !!url && !objectUrl && !error };
}
