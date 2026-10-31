import { apiClient } from "@/lib/api/apiClient";
import type { AgeBand, CatalogSong, Mood } from "@/lib/api/types";

export const CATALOG_KEY = "/api/catalog";
export const CATALOG_PAGE_SIZE = 24;

export type CatalogFilters = { mood: Mood | null; ageBand: AgeBand | null; page: number };
export type CatalogPage = { songs: CatalogSong[]; page: number; total: number };

/** Shared songs are approved, so they have a title; the fallback is only defensive. */
export const catalogTitle = (song: Pick<CatalogSong, "title">) => song.title ?? "Untitled song";

/** The request URL doubles as the SWR key; empty filters are left out. */
export function catalogKey({ mood, ageBand, page }: CatalogFilters): string {
  const params = new URLSearchParams();
  if (mood) params.set("mood", mood);
  if (ageBand) params.set("ageBand", ageBand);
  params.set("page", String(page));
  return `${CATALOG_KEY}?${params}`;
}

/** Matches every catalog page/filter key, for revalidating after a change. */
export const isCatalogKey = (key: unknown) => typeof key === "string" && key.startsWith(`${CATALOG_KEY}?`);

/** GET /api/catalog: shared songs from all accounts, newest first, 24 per page; meta { page, total }. */
export async function getCatalog(key: string): Promise<CatalogPage> {
  const { data, meta } = await apiClient<CatalogSong[]>(key);
  return {
    songs: data,
    page: typeof meta.page === "number" ? meta.page : 1,
    total: typeof meta.total === "number" ? meta.total : data.length,
  };
}

/** DELETE /api/catalog/:songId (admin): removes the song from the catalog and from every family's player. */
export async function removeFromCatalog(songId: string): Promise<void> {
  await apiClient<null>(`${CATALOG_KEY}/${encodeURIComponent(songId)}`, { method: "DELETE" });
}
