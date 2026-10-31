// Shared by the service worker (src/app/sw.ts) and the page (logout), so cache names and matchers
// can't drift apart. Dependency-free on purpose: esbuild bundles it into the worker.

/** /api/media/* responses, cache-first by full URL (the `v` hash makes each URL immutable). */
export const MEDIA_CACHE = "littleears-media";
/** /api/library responses, network-first; the cached copy is the offline fallback per childId. */
export const LIBRARY_CACHE = "littleears-library";
export const MEDIA_MAX_ENTRIES = 200;
export const LIBRARY_TIMEOUT_SECONDS = 3;

/** The API is cross-origin (NEXT_PUBLIC_API_URL), so every matcher checks origin + pathname. */
export function isMediaUrl(url: URL, apiOrigin: string): boolean {
  return url.origin === apiOrigin && url.pathname.startsWith("/api/media/");
}

export function isLibraryUrl(url: URL, apiOrigin: string): boolean {
  return url.origin === apiOrigin && url.pathname === "/api/library";
}

/** Called on logout: the next account on this device must never see this one's songs. */
export async function clearOfflineCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    await Promise.all([caches.delete(MEDIA_CACHE), caches.delete(LIBRARY_CACHE)]);
  } catch {
    // Cache Storage can be unavailable (private mode, blocked site data); nothing to clear then.
  }
}
