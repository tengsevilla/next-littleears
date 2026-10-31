"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { catalogTitle, removeFromCatalog } from "@/lib/api/catalog";
import type { CatalogSong } from "@/lib/api/types";

type Props = { song: CatalogSong | null; onClose: () => void; onRemoved: () => void };

/** Admin only: the API answers 403 for anyone else. */
export function RemoveFromCatalogDialog({ song, onClose, onRemoved }: Props) {
  const [pending, setPending] = useState(false);
  // Keep the last song so the copy doesn't blank out during the close animation.
  const [shown, setShown] = useState<CatalogSong | null>(song);
  if (song && song !== shown) setShown(song);
  const title = shown ? catalogTitle(shown) : "";

  async function handleRemove() {
    if (!song) return;
    setPending(true);
    try {
      await removeFromCatalog(song.id);
      toast.success(`Removed "${catalogTitle(song)}" from the catalog`);
      onRemoved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that song. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={!!song} onOpenChange={(open) => !open && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove &ldquo;{title}&rdquo; from the catalog?</AlertDialogTitle>
          <AlertDialogDescription>
            It disappears from the catalog and from every family&apos;s player, including the ones that added it.
            The family who made it keeps it in their own studio and player.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep it shared</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleRemove} disabled={pending}>
            {pending ? "Removing…" : "Remove for everyone"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
