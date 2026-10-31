"use client";

import { useMediaObjectUrl } from "@/hooks/api/useMediaObjectUrl";

/** Studio preview: native controls (parents may seek), fed by the authenticated object URL. */
export function SongAudio({ audioUrl, title, autoPlay }: { audioUrl: string; title: string; autoPlay?: boolean }) {
  const { objectUrl, error } = useMediaObjectUrl(audioUrl);

  if (error) return <p className="text-sm text-destructive">We couldn&apos;t load the audio. Please refresh to try again.</p>;
  if (!objectUrl) return <div aria-label="Loading audio" className="h-[54px] animate-pulse rounded-full bg-muted" />;
  return <audio controls autoPlay={autoPlay} src={objectUrl} aria-label={`Listen to ${title}`} className="w-full" />;
}
