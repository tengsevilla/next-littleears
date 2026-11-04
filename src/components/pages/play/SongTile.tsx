"use client";

import { Cloud, Moon, Music } from "lucide-react";
import { useMediaObjectUrl } from "@/hooks/api/useMediaObjectUrl";
import type { LibrarySong, Mood } from "@/lib/api/types";
import { CoverTile, TilePlaceholder } from "./CoverTile";

const MOOD_ICON: Record<Mood, typeof Music> = { playful: Music, calm: Cloud, lullaby: Moon };

/** A cover-art tile with no visible text. The accessible name is the song title, for screen readers only. */
export function SongTile({
  song,
  index,
  active,
  night,
  onPlay,
}: {
  song: LibrarySong;
  index: number;
  active: boolean;
  /** Bedtime: softer, darker tiles. */
  night: boolean;
  onPlay: (id: string) => void;
}) {
  const { objectUrl, isLoading } = useMediaObjectUrl(song.imageUrl);

  return (
    <CoverTile label={song.title ?? "Song"} active={active} night={night} badgeIcon={Music} onClick={() => onPlay(song.id)}>
      {objectUrl ? (
        // A blob: URL from the media hook; next/image can't optimize it, so a plain <img> is correct here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={objectUrl} alt="" draggable={false} className="size-full object-cover" />
      ) : (
        <TilePlaceholder icon={MOOD_ICON[song.mood]} index={index} pulse={isLoading} />
      )}
    </CoverTile>
  );
}
