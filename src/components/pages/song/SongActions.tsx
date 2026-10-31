"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { Check, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/apiClient";
import {
  approveSong,
  deleteSong,
  isSongListKey,
  PART_LABEL,
  regenerateSong,
  rejectSong,
  tryAgainHref,
} from "@/lib/api/songs";
import type { RegenPart, Song } from "@/lib/api/types";
import { DeleteSongDialog } from "./DeleteSongDialog";
import { RegenerateReadyDialog } from "./RegenerateReadyDialog";

type Busy = "approve" | "reject" | "delete" | RegenPart | null;
type Props = { song: Song; name: string; onSong: (song: Song) => void; onRefresh: () => void };

const PARTS: RegenPart[] = ["lyrics", "music", "image"];
const RATE_LIMITED = "You've made a lot of songs this hour. Please take a break and try again a little later.";
const SHARED_LOCKED = "Shared songs can't be changed — make a new song";

function failureMessage(err: unknown): string {
  if (err instanceof ApiClientError && err.code === "RATE_LIMITED") return RATE_LIMITED;
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

/** Actions allowed by the song state rules; every mutation writes the returned Song into the SWR cache. */
export function SongActions({ song, name, onSong, onRefresh }: Props) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState<Busy>(null);
  const [confirmPart, setConfirmPart] = useState<RegenPart | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { status } = song;
  const generic = song.childId === null;

  async function run(
    action: Exclude<Busy, null>,
    call: () => Promise<Song>,
    success: string,
    conflictMessage = "This song changed in the meantime, so we refreshed it.",
  ) {
    setBusy(action);
    try {
      onSong(await call()); // a song sent back to the queue resumes polling from here
      void mutate(isSongListKey);
      toast.success(success);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "CONFLICT") {
        toast.info(conflictMessage);
        onRefresh();
      } else {
        toast.error(failureMessage(err));
      }
    } finally {
      setBusy(null);
      setConfirmPart(null);
    }
  }

  // A generic song can become shared (approved) between our last read and this click: the API answers 409.
  const regenerate = (part: RegenPart) =>
    run(
      part,
      () => regenerateSong(song.id, part),
      `Redoing the ${PART_LABEL[part]}. You'll review it again after.`,
      generic ? SHARED_LOCKED : undefined,
    );

  async function handleDelete() {
    setBusy("delete");
    try {
      await deleteSong(song.id);
      toast.success(`Deleted "${name}"`);
      void mutate(isSongListKey);
      router.push("/studio");
    } catch (err) {
      toast.error(failureMessage(err));
      setBusy(null);
    }
  }

  const disabled = busy !== null;
  const canRegenerate = !song.shared && (status === "pending_review" || status === "ready");

  return (
    <div className="flex flex-col gap-5">
      {status === "pending_review" && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            disabled={disabled}
            onClick={() =>
              run(
                "approve",
                () => approveSong(song.id),
                generic
                  ? `"${name}" is in your player and now shared with all LittleEars families`
                  : `"${name}" is in the player now`,
              )
            }
          >
            <Check data-icon="inline-start" />
            {busy === "approve" ? "Approving…" : "Approve for the player"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={disabled}
            onClick={() => run("reject", () => rejectSong(song.id), "Song rejected")}
          >
            <X data-icon="inline-start" />
            {busy === "reject" ? "Rejecting…" : "Reject"}
          </Button>
          {generic && (
            <p className="w-full text-sm text-muted-foreground">
              Approving shares this song with all LittleEars families through the catalog.
            </p>
          )}
        </div>
      )}

      {song.shared && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">{SHARED_LOCKED}. Other families may already have it in their player.</p>
          <Link href="/studio/new" className={buttonVariants({ variant: "outline" })}>
            <Plus data-icon="inline-start" />
            Make a new song
          </Link>
        </div>
      )}

      {canRegenerate && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Not quite right? Redo one part</p>
          <div className="flex flex-wrap gap-2">
            {PARTS.map((part) => (
              <Button
                key={part}
                variant="outline"
                disabled={disabled}
                onClick={() => (status === "ready" ? setConfirmPart(part) : regenerate(part))}
              >
                <RotateCcw data-icon="inline-start" />
                {busy === part ? "Starting…" : `Redo ${PART_LABEL[part]}`}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {status === "ready"
              ? "Redoing a part takes this song out of the kid player until you approve it again."
              : "New lyrics need new music, so redoing the lyrics redoes both."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(status === "rejected" || status === "failed") && (
          <Link href={tryAgainHref(song)} className={buttonVariants()}>
            <RotateCcw data-icon="inline-start" />
            Try again
          </Link>
        )}
        <Button
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={disabled}
          onClick={() => setDeleting(true)}
        >
          <Trash2 data-icon="inline-start" />
          Delete song
        </Button>
      </div>

      <RegenerateReadyDialog
        part={confirmPart}
        name={name}
        pending={disabled}
        onClose={() => setConfirmPart(null)}
        onConfirm={regenerate}
      />
      <DeleteSongDialog
        open={deleting}
        name={name}
        shared={song.shared}
        pending={busy === "delete"}
        onOpenChange={setDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
