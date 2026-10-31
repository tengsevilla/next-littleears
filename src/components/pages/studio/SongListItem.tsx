import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ChildChip } from "@/components/songs/ChildChip";
import { SongCover } from "@/components/songs/SongCover";
import { SongStatusBadge } from "@/components/songs/SongStatusBadge";
import { MOODS } from "@/lib/api/songs";
import type { SongSummary } from "@/lib/api/types";
import { formatDate } from "@/lib/utils";

const MOOD_LABEL = new Map(MOODS.map((m) => [m.value, m.label]));

export function SongListItem({ song, childName }: { song: SongSummary; childName: string | undefined }) {
  const name = song.title ?? song.topic;
  return (
    <Link
      href={`/studio/songs/${song.id}`}
      className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="py-0 transition-colors group-hover:bg-muted/40">
        <CardContent className="flex items-center gap-3 px-3 py-3 sm:px-4">
          <SongCover imageUrl={song.imageUrl} alt="" className="size-14" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">
              {name}
              {!song.title && <span className="sr-only"> (no title yet)</span>}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <SongStatusBadge status={song.status} />
              {childName && <ChildChip name={childName} />}
              <span>{MOOD_LABEL.get(song.mood) ?? song.mood}</span>
              <span aria-hidden>·</span>
              <time dateTime={song.createdAt}>{formatDate(song.createdAt)}</time>
            </div>
          </div>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
