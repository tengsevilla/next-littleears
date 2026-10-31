"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { useStudioUser } from "@/components/layout/StudioUser";
import { useCatalog } from "@/hooks/api/useCatalog";
import { ApiClientError } from "@/lib/api/apiClient";
import { type CatalogFilters, type CatalogPage as CatalogData, catalogTitle, isCatalogKey } from "@/lib/api/catalog";
import { addToLibrary, isLibraryKey, removeFromLibrary } from "@/lib/api/library";
import { isSongListKey } from "@/lib/api/songs";
import type { CatalogSong } from "@/lib/api/types";
import { CatalogFilterBar } from "./CatalogFilterBar";
import { CatalogGrid } from "./CatalogGrid";
import { RemoveFromCatalogDialog } from "./RemoveFromCatalogDialog";

const withLibraryFlag = (data: CatalogData | undefined, id: string, inMyLibrary: boolean) =>
  data && { ...data, songs: data.songs.map((s) => (s.id === id ? { ...s, inMyLibrary } : s)) };

// Client-side by necessity: the bearer token lives in browser memory.
export function CatalogPage() {
  const user = useStudioUser();
  const [filters, setFilters] = useState<CatalogFilters>({ mood: null, ageBand: null, page: 1 });
  const { catalog, error, isLoading, isValidating, mutate } = useCatalog(filters);
  const { mutate: mutateAll } = useSWRConfig();
  const [removing, setRemoving] = useState<CatalogSong | null>(null);

  async function toggleLibrary(song: CatalogSong) {
    const add = !song.inMyLibrary;
    const title = catalogTitle(song);
    try {
      await mutate(
        async (current) => {
          await (add ? addToLibrary(song.id) : removeFromLibrary(song.id));
          return withLibraryFlag(current, song.id, add);
        },
        { optimisticData: (current) => withLibraryFlag(current, song.id, add)!, rollbackOnError: true, revalidate: false },
      );
      void mutateAll(isLibraryKey); // the kid player picks it up (or drops it) on its next read
      toast.success(add ? `"${title}" is in your player now` : `Took "${title}" out of your player`);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "NOT_FOUND") {
        toast.info("That song isn't shared any more, so we refreshed the catalog.");
        void mutate();
      } else {
        toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    }
  }

  function handleRemoved() {
    void mutateAll(isCatalogKey);
    void mutateAll(isLibraryKey);
    void mutateAll(isSongListKey);
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Songs other LittleEars families made and approved for everyone. Add the ones you like to your player.
        </p>
      </header>

      <CatalogFilterBar
        mood={filters.mood}
        ageBand={filters.ageBand}
        onChange={(next) => setFilters((f) => ({ ...f, ...next, page: 1 }))}
      />

      <CatalogGrid
        data={catalog}
        isLoading={isLoading}
        isValidating={isValidating}
        error={error}
        filtered={!!filters.mood || !!filters.ageBand}
        isAdmin={user.role === "admin"}
        onRetry={() => mutate()}
        onPage={(page) => setFilters((f) => ({ ...f, page }))}
        onToggleLibrary={toggleLibrary}
        onRemoveFromCatalog={setRemoving}
      />

      <RemoveFromCatalogDialog song={removing} onClose={() => setRemoving(null)} onRemoved={handleRemoved} />
    </main>
  );
}
