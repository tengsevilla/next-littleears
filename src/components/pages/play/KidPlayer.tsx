"use client";

import { useMemo, useState } from "react";
import { ListMusic, Pause, Play } from "lucide-react";
import { useLibrary } from "@/hooks/api/useLibrary";
import { useMediaSession } from "@/hooks/common/useMediaSession";
import { usePlayer } from "@/hooks/common/usePlayer";
import { cn } from "@/lib/utils";
import { LibraryState } from "./LibraryState";
import { ParentGate } from "./ParentGate";
import { ParentMenu } from "./ParentMenu";
import { SleepOverlay } from "./SleepOverlay";
import { SongTile } from "./SongTile";

/** Full-screen cover grid + one huge play/pause. No text, no seek bar, no links out (those sit behind the gate). */
export function KidPlayer({
  childId,
  night,
  onChangeChild,
}: {
  childId: string | null;
  night: boolean;
  onChangeChild: () => void;
}) {
  const { songs: library, error, isLoading } = useLibrary(childId);
  // The backend only returns `ready` songs; one without audio can't be played, so it isn't shown.
  const songs = useMemo(() => library?.filter((s) => s.audioUrl) ?? [], [library]);
  const player = usePlayer(songs);
  const [menuOpen, setMenuOpen] = useState(false);

  useMediaSession({
    title: player.current?.title ?? null,
    coverUrl: player.coverUrl,
    playing: player.playing,
    onNext: player.inPlayAll ? player.next : null,
    onPlay: player.resume,
    onPause: player.pause,
  });

  const activeId = player.playing ? player.current?.id : null;
  const hasSongs = songs.length > 0;

  return (
    <main
      className={cn(
        "relative flex min-h-dvh flex-1 flex-col select-none",
        night ? "bg-[oklch(0.2_0.03_50)] text-amber-50" : "bg-[oklch(0.97_0.03_85)] text-stone-900",
      )}
    >
      <div className="flex p-4">
        <ParentGate night={night} onUnlock={() => setMenuOpen(true)} />
      </div>

      {isLoading ? (
        <SongGridFrame>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} aria-hidden className={cn("aspect-square animate-pulse rounded-[2rem]", night ? "bg-white/10" : "bg-stone-900/10")} />
          ))}
        </SongGridFrame>
      ) : hasSongs ? (
        <SongGridFrame>
          {songs.map((song, i) => (
            <li key={song.id}>
              <SongTile song={song} index={i} active={song.id === activeId} night={night} onPlay={player.playSong} />
            </li>
          ))}
        </SongGridFrame>
      ) : (
        <LibraryState kind={error ? "unavailable" : "empty"} night={night} />
      )}

      {hasSongs && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-20 flex items-center justify-center gap-8 bg-linear-to-t px-6 pt-10 pb-8",
            night ? "from-[oklch(0.2_0.03_50)] via-[oklch(0.2_0.03_50)]/90" : "from-[oklch(0.97_0.03_85)] via-[oklch(0.97_0.03_85)]/90",
          )}
        >
          <button
            type="button"
            aria-label="Play all"
            aria-pressed={player.inPlayAll}
            onClick={player.playAll}
            className={cn(
              "flex size-24 items-center justify-center rounded-full shadow-lg outline-none focus-visible:ring-8 active:scale-95",
              night ? "bg-sky/70 text-stone-900 focus-visible:ring-amber-200/60" : "bg-sky text-stone-900 focus-visible:ring-sunshine",
              player.inPlayAll && "ring-8 ring-sunshine",
            )}
          >
            <ListMusic aria-hidden className="size-12" />
          </button>
          <button
            type="button"
            aria-label={player.playing ? "Pause" : "Play"}
            onClick={player.toggle}
            className={cn(
              "flex size-36 items-center justify-center rounded-full shadow-xl outline-none focus-visible:ring-8 active:scale-95",
              night ? "bg-amber-300 text-stone-900 focus-visible:ring-amber-100/70" : "bg-primary text-white focus-visible:ring-sky",
            )}
          >
            {player.playing ? <Pause aria-hidden className="size-20 fill-current" /> : <Play aria-hidden className="ml-2 size-20 fill-current" />}
          </button>
        </div>
      )}

      {/* The only audio element. Hidden: no controls, no seek bar. */}
      <audio {...player.audioProps} preload="auto" className="hidden" />

      {player.asleep && <SleepOverlay onWake={player.wake} />}

      <ParentMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        emptyLibrary={!isLoading && !hasSongs}
        onChangeChild={onChangeChild}
      />
    </main>
  );
}

function SongGridFrame({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Songs" className="flex-1 px-6 pb-56">
      <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">{children}</ul>
    </section>
  );
}
