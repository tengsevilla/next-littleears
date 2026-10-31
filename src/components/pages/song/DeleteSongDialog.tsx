"use client";

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

type Props = {
  open: boolean;
  name: string;
  /** Shared songs are only removed from this family: they stay in the catalog for everyone else. */
  shared: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DeleteSongDialog({ open, name, shared, pending, onOpenChange, onConfirm }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            {shared ? (
              <>
                It will leave your studio and your player. Because it&apos;s shared, it stays in the catalog for other
                families, and anyone who added it keeps it in their player.
              </>
            ) : (
              <>
                Its lyrics, music and cover will be deleted, and it will leave the player. Deleted songs can&apos;t be
                recovered.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete song"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
