"use client";

import { useMemo, useState } from "react";
import { AudioWaveform, ListMusic, Music, Pause, Play, type LucideIcon } from "lucide-react";
import { useLibrary } from "@/hooks/api/useLibrary";
import { useSoundPlayer } from "@/hooks/common/useSoundPlayer";
import { useMediaSession } from "@/hooks/common/useMediaSession";
import { usePlayer } from "@/hooks/common/usePlayer";
import { readPlayerView, savePlayerView, type PlayerView } from "@/lib/playerChoice";
import { SOUNDS, type Sound } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { LibraryState } from "./LibraryState";
import { ParentGate } from "./ParentGate";
import { ParentMenu } from "./ParentMenu";
import { SleepOverlay } from "./SleepOverlay";
import { SongTile } from "./SongTile";
import { SoundTile } from "./SoundTile";

/**
 * Full-screen cover grid + one huge play/pause. No text, no seek bar, no links out (those sit behind the gate).
 * Two picture toggles switch between the songs and the sounds (loops and stories). Only one thing plays at a time:
 * a song's audio starting stops the sound, and starting a sound pauses the song.
 */
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
  const sounds = useSoundPlayer();
  const [menuOpen, setMenuOpen] = useState(false);
  // Read once on mount: the player is client-only (see PlayerApp), so storage is hydration-safe here.
  const [view, setView] = useState<PlayerView>(readPlayerView);
  // Whichever was started last owns the lock-screen controls.
  const [source, setSource] = useState<"song" | "sound">("song");

  function chooseView(next: PlayerView) {
    savePlayerView(next);
    setView(next);
  }

  function startSound(sound: Sound) {
    player.pause();
    setSource("sound");
    void sounds.start(sound);
  }

  function tapSound(sound: Sound) {
    if (sounds.playingSlug === sound.slug) sounds.stop();
    else startSound(sound);
  }

  const sound = source === "sound" ? sounds.current : null;
  useMediaSession(
    sound
      ? { title: sound.title, coverUrl: sound.cover, playing: sounds.playing, onNext: null, onPlay: () => startSound(sound), onPause: sounds.stop }
      : {
          title: player.current?.title ?? null,
          coverUrl: player.coverUrl,
          playing: player.playing,
          onNext: player.inPlayAll ? player.next : null,
          onPlay: player.resume,
          onPause: player.pause,
        },
  );

  const activeId = player.playing ? player.current?.id : null;
  const hasSongs = songs.length > 0;
  const audioProps = {
    ...player.audioProps,
    onPlay: () => {
      // Covers every way a song starts (tile, play all, big button, lock screen).
      sounds.stop();
      setSource("song");
      player.audioProps.onPlay();
    },
  };

  return (
    <main
      className={cn(
        "relative flex min-h-dvh flex-1 flex-col select-none",
        night ? "bg-[oklch(0.2_0.03_50)] text-amber-50" : "bg-[oklch(0.97_0.03_85)] text-stone-900",
      )}
    >
      <div className="flex items-center gap-4 p-4">
        <ParentGate night={night} onUnlock={() => setMenuOpen(true)} />
        <div role="group" aria-label="Songs or sounds" className="flex flex-1 justify-center gap-4">
          <ViewToggle label="Songs" icon={Music} pressed={view === "songs"} night={night} onClick={() => chooseView("songs")} />
          <ViewToggle label="Sounds" icon={AudioWaveform} pressed={view === "sounds"} night={night} onClick={() => chooseView("sounds")} />
        </div>
      </div>

      {view === "sounds" ? (
        <section aria-label="Sounds" className="flex-1 px-6 pb-12">
          <ul className={GRID}>
            {SOUNDS.map((s, i) => (
              <li key={s.slug}>
                <SoundTile sound={s} index={i} active={sounds.playingSlug === s.slug} night={night} onToggle={tapSound} />
              </li>
            ))}
          </ul>
        </section>
      ) : isLoading ? (
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

      {view === "songs" && hasSongs && (
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
      <audio {...audioProps} preload="auto" className="hidden" />

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

const GRID = "mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4";

function SongGridFrame({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Songs" className="flex-1 px-6 pb-56">
      <ul className={GRID}>{children}</ul>
    </section>
  );
}

/** A picture-only switch between the two grids; the name is for screen readers. */
function ViewToggle({
  label,
  icon: Icon,
  pressed,
  night,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  pressed: boolean;
  night: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex size-24 shrink-0 items-center justify-center rounded-[2rem] shadow-md transition-transform outline-none focus-visible:ring-8 active:scale-95",
        night
          ? pressed
            ? "bg-amber-300 text-stone-900 focus-visible:ring-amber-100/70"
            : "bg-white/5 text-amber-100/50 focus-visible:ring-amber-200/60"
          : pressed
            ? "bg-primary text-white focus-visible:ring-sky"
            : "bg-stone-900/5 text-stone-900/50 focus-visible:ring-sky",
      )}
    >
      <Icon aria-hidden className="size-12" />
    </button>
  );
}
