"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaObjectUrl } from "@/hooks/api/useMediaObjectUrl";
import type { LibrarySong } from "@/lib/api/types";

/** "Play all" never queues more than this many songs. */
export const PLAY_ALL_MAX = 5;
/** Lullabies ramp the element volume to 0 over their last N seconds (on top of the server's fade). */
export const SLEEP_FADE_SEC = 20;

type Queue = { ids: string[]; index: number; all: boolean };

/**
 * One <audio> element for the whole player. By default a song plays once and stops; "play all" walks the
 * first PLAY_ALL_MAX songs, then stops. The current song's audio comes through the authenticated media hook,
 * which revokes the previous object URL whenever the song changes.
 */
export function usePlayer(songs: LibrarySong[]) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const wantPlay = useRef(false);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [playing, setPlaying] = useState(false);
  const [asleep, setAsleep] = useState(false);

  const currentId = queue ? queue.ids[queue.index] : null;
  const current = songs.find((s) => s.id === currentId) ?? null;
  const { objectUrl: src } = useMediaObjectUrl(current?.audioUrl ?? null);
  const { objectUrl: coverUrl } = useMediaObjectUrl(current?.imageUrl ?? null);

  const resume = useCallback(() => {
    wantPlay.current = true;
    // Rejections (autoplay policy, undecodable file) leave the element paused; the UI follows its events.
    audioRef.current?.play().catch(() => {});
  }, []);

  const pause = useCallback(() => {
    wantPlay.current = false;
    audioRef.current?.pause();
  }, []);

  // A new song's object URL is ready (React has already set it as `src`): start from full volume.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src) return;
    el.volume = 1;
    // Some browsers carry "playing" over to a new src; make the element match what was asked for.
    if (wantPlay.current) el.play().catch(() => {});
    else el.pause();
  }, [src]);

  const start = useCallback(
    (next: Queue) => {
      setAsleep(false);
      setQueue(next);
      wantPlay.current = true;
      const el = audioRef.current;
      if (!el) return;
      // Same song as before: `src` won't change, so restart it here. A different song: silence the old one
      // right away; the [src] effect starts the new one once its audio has loaded.
      if (next.ids[next.index] === currentId && src) {
        el.currentTime = 0;
        resume();
      } else {
        el.pause();
      }
    },
    [currentId, src, resume],
  );

  const playSong = useCallback(
    (id: string) => {
      if (id === currentId && audioRef.current && !audioRef.current.paused) return pause();
      start({ ids: [id], index: 0, all: false });
    },
    [currentId, pause, start],
  );

  const playAll = useCallback(() => {
    const ids = songs.slice(0, PLAY_ALL_MAX).map((s) => s.id);
    if (ids.length) start({ ids, index: 0, all: true });
  }, [songs, start]);

  const toggle = useCallback(() => {
    setAsleep(false);
    if (!current) {
      if (songs[0]) start({ ids: [songs[0].id], index: 0, all: false });
      return;
    }
    if (audioRef.current?.paused) resume();
    else pause();
  }, [current, songs, start, resume, pause]);

  const next = useCallback(() => {
    if (!queue?.all || queue.index + 1 >= queue.ids.length) return false;
    wantPlay.current = true;
    // Silence the finished (or skipped) song now; the [src] effect starts the next once its audio loads.
    audioRef.current?.pause();
    setQueue({ ...queue, index: queue.index + 1 });
    return true;
  }, [queue]);

  const onEnded = useCallback(() => {
    if (next()) return;
    pause();
    setQueue((q) => (q ? { ...q, all: false } : q));
    if (current?.mood === "lullaby") setAsleep(true);
  }, [next, pause, current?.mood]);

  const onTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el || current?.mood !== "lullaby") return;
    const left = el.duration - el.currentTime;
    // iOS ignores `volume`; there the server-side fade is all you get, which is acceptable.
    if (Number.isFinite(left)) el.volume = Math.max(0, Math.min(1, left / SLEEP_FADE_SEC));
  }, [current?.mood]);

  // Never leave sound running after the player unmounts (e.g. "Back to studio").
  useEffect(() => {
    const el = audioRef.current;
    return () => el?.pause();
  }, []);

  return {
    audioProps: {
      ref: audioRef,
      src: src ?? undefined,
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
      onEnded,
      onTimeUpdate,
    },
    current,
    coverUrl,
    playing,
    inPlayAll: !!queue?.all,
    asleep,
    wake: () => setAsleep(false),
    playSong,
    playAll,
    toggle,
    pause,
    resume,
    next,
  };
}
