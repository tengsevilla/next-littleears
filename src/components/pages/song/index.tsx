"use client";

import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildChip } from "@/components/songs/ChildChip";
import { SongCover } from "@/components/songs/SongCover";
import { SongStatusBadge } from "@/components/songs/SongStatusBadge";
import { useChildren } from "@/hooks/api/useChildren";
import { useSong } from "@/hooks/api/useSong";
import { ApiClientError } from "@/lib/api/apiClient";
import { isInProgress, MOODS } from "@/lib/api/songs";
import { formatDate } from "@/lib/utils";
import { SongActions } from "./SongActions";
import { SongAudio } from "./SongAudio";
import { SongLyrics } from "./SongLyrics";
import { SongProgress } from "./SongProgress";
import { SongSafety } from "./SongSafety";

const MOOD_LABEL = new Map(MOODS.map((m) => [m.value, m.label]));

export function SongDetailPage({ id }: { id: string }) {
  const { song, error, isLoading, mutate } = useSong(id);
  const { children } = useChildren();

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col">
        <Skeleton aria-label="Loading song" className="h-64 rounded-xl" />
      </main>
    );
  }
  if (!song) {
    const missing = error instanceof ApiClientError && error.code === "NOT_FOUND";
    return (
      <main className="flex flex-1 flex-col">
        <Card>
          <CardContent className="flex flex-col items-start gap-3 text-sm">
            <p role="alert">
              {missing ? "We couldn't find that song." : `We couldn't load this song: ${error?.message}`}
            </p>
            <div className="flex gap-2">
              {!missing && <Button onClick={() => mutate()}>Try again</Button>}
              <Link href="/studio" className={buttonVariants({ variant: "outline" })}>
                Back to songs
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const name = song.title ?? song.topic;
  const childName = song.childId ? children?.find((c) => c.id === song.childId)?.displayName : undefined;

  return (
    <main className="flex flex-1 flex-col gap-6">
      <Link
        href="/studio"
        className="flex w-fit items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All songs
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <SongCover imageUrl={song.imageUrl} alt={`Cover for ${name}`} className="size-40" />
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight break-words">{name}</h1>
          {song.title && <p className="text-sm text-muted-foreground">About: {song.topic}</p>}
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <SongStatusBadge status={song.status} />
            {song.shared && (
              <Badge className="bg-sky/30 font-semibold text-sky-950 dark:bg-sky/20 dark:text-sky-100">
                <Users data-icon="inline-start" />
                Shared with all families
              </Badge>
            )}
            {childName && <ChildChip name={childName} />}
            <span>{MOOD_LABEL.get(song.mood) ?? song.mood}</span>
            <span aria-hidden>·</span>
            <span>{song.lengthSec} s</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Made <time dateTime={song.createdAt}>{formatDate(song.createdAt)}</time>
            {song.approvedAt && (
              <>
                {" · Approved "}
                <time dateTime={song.approvedAt}>{formatDate(song.approvedAt)}</time>
              </>
            )}
          </p>
        </div>
      </header>

      {isInProgress(song.status) && <SongProgress status={song.status} />}

      {song.status === "failed" && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Something went wrong making this song</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {song.error ?? "We don't know why. Please try again."}
          </CardContent>
        </Card>
      )}
      {song.status === "rejected" && (
        <Card>
          <CardHeader>
            <CardTitle>This song was rejected</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {song.safety?.pass === false
              ? "It kept failing our safety check, so it never reached the player."
              : "You rejected it, so it never reached the player."}
          </CardContent>
        </Card>
      )}

      {(song.audioUrl || song.lyrics || song.safety) && (
        <Card>
          <CardContent className="flex flex-col gap-5">
            {song.audioUrl && <SongAudio audioUrl={song.audioUrl} title={name} />}
            {song.safety && <SongSafety safety={song.safety} />}
            {song.lyrics && <SongLyrics lyrics={song.lyrics} />}
          </CardContent>
        </Card>
      )}

      <SongActions
        song={song}
        name={name}
        onSong={(next) => mutate(next, { revalidate: false })}
        onRefresh={() => mutate()}
      />
    </main>
  );
}
