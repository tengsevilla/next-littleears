"use client";

import { useState } from "react";
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
import { PART_LABEL } from "@/lib/api/songs";
import type { RegenPart } from "@/lib/api/types";

type Props = {
  part: RegenPart | null;
  name: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: (part: RegenPart) => void;
};

/** Ready songs are in the kid player; redoing a part pulls the song out until it is approved again. */
export function RegenerateReadyDialog({ part, name, pending, onClose, onConfirm }: Props) {
  // Keep the last part so the copy doesn't blank out during the close animation.
  const [shown, setShown] = useState<RegenPart | null>(part);
  if (part && part !== shown) setShown(part);
  const label = shown ? PART_LABEL[shown] : "";

  return (
    <AlertDialog open={!!part} onOpenChange={(open) => !open && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Redo the {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{name}&rdquo; will leave the kid player and go back to review. It comes back once you listen and
            approve it again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep it playing</AlertDialogCancel>
          <AlertDialogAction onClick={() => part && onConfirm(part)} disabled={pending}>
            {pending ? "Starting…" : `Redo the ${label}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
