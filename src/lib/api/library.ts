import { apiClient } from "@/lib/api/apiClient";
import type { LibrarySong } from "@/lib/api/types";

/** childId null = only the shared songs in my library. The URL doubles as the SWR key and the service worker's cache key. */
export const libraryKey = (childId: string | null) =>
  childId ? `/api/library?childId=${encodeURIComponent(childId)}` : "/api/library";

/** GET /api/library: my `ready` songs for that child + the shared songs in my library, enforced by the backend. */
export async function getLibrary(key: string): Promise<LibrarySong[]> {
  const { data } = await apiClient<LibrarySong[]>(key);
  return data;
}

/** Matches every kid-player library key (all childIds), for revalidating after a library change. */
export const isLibraryKey = (key: unknown) =>
  key === "/api/library" || (typeof key === "string" && key.startsWith("/api/library?"));

/** POST /api/library/items: add a shared song to MY player. Idempotent; 404 if the song isn't shared. */
export async function addToLibrary(songId: string): Promise<void> {
  await apiClient<null>("/api/library/items", { method: "POST", body: JSON.stringify({ songId }) });
}

/** DELETE /api/library/items/:songId: take it out of MY player (the song itself is untouched). */
export async function removeFromLibrary(songId: string): Promise<void> {
  await apiClient<null>(`/api/library/items/${encodeURIComponent(songId)}`, { method: "DELETE" });
}
