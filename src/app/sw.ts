/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, CacheableResponsePlugin, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";
import {
  isLibraryUrl,
  isMediaUrl,
  LIBRARY_CACHE,
  LIBRARY_TIMEOUT_SECONDS,
  MEDIA_CACHE,
  MEDIA_MAX_ENTRIES,
} from "../lib/offline";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Inlined at bundle time (esbuild `define` in src/app/serwist/[path]/route.ts, which fails the build if unset).
const API_ORIGIN = new URL(process.env.NEXT_PUBLIC_API_URL!).origin;

// Cache entries are keyed by the full URL only: the bearer token and Vary (e.g. Origin) never split them,
// so a cached response is served offline even when the page has no token.
const matchOptions: CacheQueryOptions = { ignoreVary: true };

// App shell: precached URLs (incl. /play and /~offline, see the route) are served cache-first by Serwist,
// so /play opens offline. Other navigations go to the network and fall back to /~offline.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Kid-player media: immutable per URL (`v` = hash of the S3 key). Only full 200 bodies are stored —
      // never 206 range slices or errors.
      matcher: ({ url }) => isMediaUrl(url, API_ORIGIN),
      handler: new CacheFirst({
        cacheName: MEDIA_CACHE,
        matchOptions,
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({ maxEntries: MEDIA_MAX_ENTRIES, matchOptions, purgeOnQuotaError: true }),
        ],
      }),
    },
    {
      // Library: fresh when online, the last good list for that childId when offline or slow.
      matcher: ({ url }) => isLibraryUrl(url, API_ORIGIN),
      handler: new NetworkFirst({
        cacheName: LIBRARY_CACHE,
        networkTimeoutSeconds: LIBRARY_TIMEOUT_SECONDS,
        matchOptions,
        plugins: [new CacheableResponsePlugin({ statuses: [200] })],
      }),
    },
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
