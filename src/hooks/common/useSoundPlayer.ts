"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SOUND_SAMPLE_RATE, type Sound } from "@/lib/sounds";

/** Gain ramp when a sound starts or is stopped by a tap. */
export const SOUND_FADE_SEC = 1;
/** A sound repeats until stopped, but ends by itself after this many passes. */
export const MAX_PLAYS = 10;
/** Loops have no fade of their own, so their last pass fades out over this long. Stories end on their file's fade. */
export const LOOP_END_FADE_SEC = 10;

type Active = { slug: string; source: AudioBufferSourceNode; gain: GainNode };

/**
 * The window that repeats, in seconds of the buffer. Stories repeat whole. Loops use their manifest points,
 * clamped the way Web Audio clamps them (an empty window means Web Audio loops the whole buffer).
 */
function loopWindow(sound: Sound, buffer: AudioBuffer) {
  const whole = { start: 0, end: buffer.duration };
  if (sound.kind === "story") return whole;
  const start = sound.loopStartSample !== undefined ? sound.loopStartSample / SOUND_SAMPLE_RATE : 0;
  const end = Math.min(sound.loopEndSample !== undefined ? sound.loopEndSample / SOUND_SAMPLE_RATE : buffer.duration, buffer.duration);
  return end > start ? { start, end } : whole;
}

/**
 * Background sounds through Web Audio, repeated gaplessly with `AudioBufferSourceNode.loop` (`<audio loop>`
 * leaves an audible gap with MP3). Every sound repeats until stopped and ends by itself after MAX_PLAYS
 * passes: stories on their own built-in fade, loops with a LOOP_END_FADE_SEC fade. When a sound ends by
 * itself the player goes idle. One AudioContext for the player, created/resumed inside the tap that starts
 * a sound (iOS needs the gesture). Decoded buffers are kept per slug for the life of the player. Only one
 * sound plays at a time.
 */
export function useSoundPlayer() {
  const ctxRef = useRef<AudioContext | null>(null);
  const buffers = useRef(new Map<string, Promise<AudioBuffer>>());
  const active = useRef<Active | null>(null);
  // Bumped by every start/stop, so a slow fetch/decode can't start a sound that was stopped meanwhile.
  const generation = useRef(0);
  const [current, setCurrent] = useState<Sound | null>(null);
  const [playing, setPlaying] = useState(false);

  const fadeOut = useCallback((fadeSec: number) => {
    generation.current++;
    setPlaying(false);
    const node = active.current;
    const ctx = ctxRef.current;
    active.current = null;
    if (!node || !ctx) return;
    const now = ctx.currentTime;
    const gain = node.gain.gain;
    // Also drops a loop's scheduled end fade.
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + fadeSec);
    // Replaces the scheduled end-of-plays stop (the last stop() call wins).
    node.source.stop(now + fadeSec);
  }, []);

  const stop = useCallback(() => fadeOut(SOUND_FADE_SEC), [fadeOut]);

  const load = useCallback((ctx: AudioContext, sound: Sound) => {
    let pending = buffers.current.get(sound.slug);
    if (!pending) {
      pending = fetch(sound.src)
        .then((res) => {
          if (!res.ok) throw new Error(`Sound ${sound.slug}: HTTP ${res.status}`);
          return res.arrayBuffer();
        })
        .then((bytes) => ctx.decodeAudioData(bytes));
      // A failed load isn't cached: the next tap tries again (e.g. back online, file now deployed).
      pending.catch(() => buffers.current.delete(sound.slug));
      buffers.current.set(sound.slug, pending);
    }
    return pending;
  }, []);

  const start = useCallback(
    async (sound: Sound) => {
      // Synchronous part runs inside the user gesture: create/resume the context there.
      const ctx = (ctxRef.current ??= new AudioContext());
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      fadeOut(SOUND_FADE_SEC);
      const mine = ++generation.current;
      setCurrent(sound);
      setPlaying(true);

      let buffer: AudioBuffer;
      try {
        buffer = await load(ctx, sound);
      } catch {
        if (mine === generation.current) setPlaying(false);
        return;
      }
      if (mine !== generation.current || ctxRef.current !== ctx) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      if (sound.kind === "story") {
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
      } else {
        if (sound.loopStartSample !== undefined) source.loopStart = sound.loopStartSample / SOUND_SAMPLE_RATE;
        if (sound.loopEndSample !== undefined) source.loopEnd = sound.loopEndSample / SOUND_SAMPLE_RATE;
      }
      const gain = ctx.createGain();
      source.connect(gain).connect(ctx.destination);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        // Ended after its last pass: still the active node, so nothing stopped or replaced it.
        if (active.current?.source === source) {
          active.current = null;
          generation.current++;
          setPlaying(false);
        }
      };

      const window_ = loopWindow(sound, buffer);
      const now = ctx.currentTime;
      const end = now + MAX_PLAYS * (window_.end - window_.start);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + SOUND_FADE_SEC);
      if (sound.kind === "loop") {
        gain.gain.setValueAtTime(1, Math.max(end - LOOP_END_FADE_SEC, now + SOUND_FADE_SEC));
        gain.gain.linearRampToValueAtTime(0, end);
      }
      source.start(now, window_.start);
      source.stop(end);
      active.current = { slug: sound.slug, source, gain };
    },
    [fadeOut, load],
  );

  // Leaving the player (unmount, or hidden by navigation) silences it at once and releases the context.
  useEffect(
    () => () => {
      generation.current++;
      const node = active.current;
      active.current = null;
      try {
        node?.source.stop();
      } catch {
        // Already stopped.
      }
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      // Buffers decoded by the closed context stay valid; keeping them avoids a refetch on return.
      setPlaying(false);
    },
    [],
  );

  return { current, playing, playingSlug: playing ? (current?.slug ?? null) : null, start, stop };
}
