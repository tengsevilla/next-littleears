import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SongSummary } from "@/lib/api/types";
import { SongListItem } from "./SongListItem";

type Props = {
  items: SongSummary[] | undefined;
  isLoading: boolean;
  error: Error | undefined;
  /** A status filter is active, so an empty list means "none in this group", not "no songs at all". */
  filtered: boolean;
  childNames: Map<string, string>;
  onRetry: () => void;
};

export function SongList({ items, isLoading, error, filtered, childNames, onRetry }: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading songs">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error && !items) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p role="alert">We couldn&apos;t load your songs: {error.message}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!items?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="font-semibold">{filtered ? "No songs here right now" : "No songs yet"}</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Pick a topic and a mood. We write it, sing it and draw a cover, then you listen first.
          </p>
          <Link href="/studio/new" className={buttonVariants()}>
            Make your first song
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Songs">
      {items.map((song) => (
        <li key={song.id}>
          <SongListItem song={song} childName={song.childId ? childNames.get(song.childId) : undefined} />
        </li>
      ))}
    </ul>
  );
}
