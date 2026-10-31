"use client";

import { useState } from "react";
import { Check, ChevronDown, Headphones, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SongAudio } from "@/components/pages/song/SongAudio";
import { SongLyrics } from "@/components/pages/song/SongLyrics";
import { SongCover } from "@/components/songs/SongCover";
import { catalogTitle } from "@/lib/api/catalog";
import { AGE_BANDS } from "@/lib/api/children";
import { MOODS } from "@/lib/api/songs";
import type { CatalogSong } from "@/lib/api/types";
import { cn, formatDuration } from "@/lib/utils";

const MOOD_LABEL = new Map(MOODS.map((m) => [m.value, m.label]));
const AGE_LABEL = new Map(AGE_BANDS.map((b) => [b.value, b.label]));

type Props = {
  song: CatalogSong;
  isAdmin: boolean;
  onToggleLibrary: (song: CatalogSong) => Promise<void>;
  onRemoveFromCatalog: (song: CatalogSong) => void;
};

export function CatalogCard({ song, isAdmin, onToggleLibrary, onRemoveFromCatalog }: Props) {
  const [listening, setListening] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const title = catalogTitle(song);
  const lyricsId = `lyrics-${song.id}`;

  async function toggle() {
    setPending(true);
    await onToggleLibrary(song);
    setPending(false);
  }

  return (
    <Card className="h-full py-0" aria-label={title} role="article">
      <CardContent className="flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex gap-3">
          <SongCover imageUrl={song.imageUrl} alt={`Cover for ${title}`} className="size-20" />
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-bold break-words">{title}</h2>
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <span>{MOOD_LABEL.get(song.mood) ?? song.mood}</span>
              <span aria-hidden>·</span>
              <span>{AGE_LABEL.get(song.ageBand) ?? song.ageBand}</span>
              {song.durationMs != null && (
                <>
                  <span aria-hidden>·</span>
                  <span>{formatDuration(song.durationMs)}</span>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {song.mine && <Badge variant="secondary">Yours</Badge>}
              {song.inMyLibrary && (
                <Badge className="bg-meadow/40 font-semibold text-emerald-950 dark:bg-meadow/25 dark:text-emerald-100">
                  In your player
                </Badge>
              )}
            </div>
          </div>
        </div>

        {listening && song.audioUrl ? (
          <SongAudio audioUrl={song.audioUrl} title={title} autoPlay />
        ) : (
          song.audioUrl && (
            <Button variant="outline" className="w-fit" onClick={() => setListening(true)}>
              <Headphones data-icon="inline-start" />
              Listen
            </Button>
          )
        )}

        {song.lyrics && (
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit"
              aria-expanded={lyricsOpen}
              aria-controls={lyricsId}
              onClick={() => setLyricsOpen((o) => !o)}
            >
              <ChevronDown data-icon="inline-start" className={cn("transition-transform", lyricsOpen && "rotate-180")} />
              {lyricsOpen ? "Hide lyrics" : "Show lyrics"}
            </Button>
            {lyricsOpen && (
              <div id={lyricsId} className="rounded-lg bg-muted/50 px-3 py-2">
                <SongLyrics lyrics={song.lyrics} />
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2">
          <Button variant={song.inMyLibrary ? "outline" : "default"} disabled={pending} onClick={toggle}>
            {song.inMyLibrary ? <Check data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
            {song.inMyLibrary ? "Remove from my player" : "Add to my player"}
          </Button>
          {isAdmin && (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onRemoveFromCatalog(song)}
            >
              <Trash2 data-icon="inline-start" />
              Remove from catalog
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
