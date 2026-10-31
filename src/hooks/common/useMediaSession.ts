"use client";

import { useEffect, useRef } from "react";

type Options = {
  title: string | null;
  coverUrl: string | null;
  playing: boolean;
  /** Next track is offered only while "play all" is running. */
  onNext: (() => void) | null;
  onPlay: () => void;
  onPause: () => void;
};

/** Lock-screen / headset controls. Feature-detected: a no-op where the Media Session API is missing. */
export function useMediaSession({ title, coverUrl, playing, onNext, onPlay, onPause }: Options) {
  // Handlers change identity every render; the registered ones read the latest through this ref.
  const latest = useRef({ onNext, onPlay, onPause });
  useEffect(() => {
    latest.current = { onNext, onPlay, onPause };
  });

  const hasNext = !!onNext;

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    session.metadata =
      title && typeof MediaMetadata !== "undefined"
        ? new MediaMetadata({ title, artist: "LittleEars", artwork: coverUrl ? [{ src: coverUrl }] : [] })
        : null;
    session.setActionHandler("play", () => latest.current.onPlay());
    session.setActionHandler("pause", () => latest.current.onPause());
    session.setActionHandler("nexttrack", hasNext ? () => latest.current.onNext?.() : null);
  }, [title, coverUrl, hasNext]);

  useEffect(() => {
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  useEffect(
    () => () => {
      if (!("mediaSession" in navigator)) return;
      const session = navigator.mediaSession;
      session.metadata = null;
      for (const action of ["play", "pause", "nexttrack"] as const) session.setActionHandler(action, null);
    },
    [],
  );
}
