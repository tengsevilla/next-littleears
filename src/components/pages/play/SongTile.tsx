"use client";

import { Cloud, Moon, Music } from "lucide-react";
import { useMediaObjectUrl } from "@/hooks/api/useMediaObjectUrl";
import type { LibrarySong, Mood } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const PLACEHOLDER = ["bg-sunshine", "bg-sky", "bg-meadow", "bg-primary"] as const;
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
  const Icon = MOOD_ICON[song.mood];

  return (
    <button
      type="button"
      aria-label={song.title ?? "Song"}
      aria-pressed={active}
      onClick={() => onPlay(song.id)}
      className={cn(
        "relative aspect-square min-h-24 w-full overflow-hidden rounded-[2rem] shadow-lg ring-4 ring-black/10 transition-transform duration-300 outline-none focus-visible:ring-8 focus-visible:ring-sky active:scale-95",
        night && !active && "brightness-[0.7] saturate-[0.8]",
        active && "z-10 scale-[1.04] shadow-2xl ring-8 ring-sunshine",
      )}
    >
      {objectUrl ? (
        // A blob: URL from the media hook; next/image can't optimize it, so a plain <img> is correct here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={objectUrl} alt="" draggable={false} className="size-full object-cover" />
      ) : (
        <span
          aria-hidden
          className={cn(
            "flex size-full items-center justify-center text-stone-900/50",
            PLACEHOLDER[index % PLACEHOLDER.length],
            isLoading && "animate-pulse",
          )}
        >
          <Icon className="size-1/3" />
        </span>
      )}
      {active && (
        <span
          aria-hidden
          className="absolute right-3 bottom-3 flex size-14 animate-bounce items-center justify-center rounded-full bg-sunshine text-stone-900 shadow-lg [animation-duration:1.6s]"
        >
          <Music className="size-7" />
        </span>
      )}
    </button>
  );
}
