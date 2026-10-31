import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CATALOG_PAGE_SIZE, type CatalogPage } from "@/lib/api/catalog";
import type { CatalogSong } from "@/lib/api/types";
import { CatalogCard } from "./CatalogCard";

type Props = {
  data: CatalogPage | undefined;
  isLoading: boolean;
  isValidating: boolean;
  error: Error | undefined;
  /** A filter is active, so an empty page means "nothing matches", not "the catalog is empty". */
  filtered: boolean;
  isAdmin: boolean;
  onRetry: () => void;
  onPage: (page: number) => void;
  onToggleLibrary: (song: CatalogSong) => Promise<void>;
  onRemoveFromCatalog: (song: CatalogSong) => void;
};

export function CatalogGrid({ data, isLoading, isValidating, error, filtered, isAdmin, onRetry, onPage, ...actions }: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading the catalog">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p role="alert">We couldn&apos;t load the catalog: {error.message}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data?.songs.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="font-semibold">{filtered ? "No shared songs match" : "No shared songs yet"}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {filtered
              ? "Try another mood or age."
              : "When a family approves a generic song, it shows up here for everyone. Yours could be the first."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const pages = Math.max(1, Math.ceil(data.total / CATALOG_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="Shared songs" aria-busy={isValidating || undefined} className="grid gap-3 sm:grid-cols-2">
        {data.songs.map((song) => (
          <li key={song.id}>
            <CatalogCard song={song} isAdmin={isAdmin} {...actions} />
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav aria-label="Catalog pages" className="flex items-center justify-between gap-3">
          <Button variant="outline" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
            <ChevronLeft data-icon="inline-start" />
            Newer
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {pages}
          </span>
          <Button variant="outline" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>
            Older
            <ChevronRight data-icon="inline-end" />
          </Button>
        </nav>
      )}
    </div>
  );
}
