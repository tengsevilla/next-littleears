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
import { deleteChild } from "@/lib/api/children";
import type { Child } from "@/lib/api/types";

type Props = { child: Child | null; onClose: () => void; onDeleted: () => void };

export function DeleteChildDialog({ child, onClose, onDeleted }: Props) {
  const [pending, setPending] = useState(false);
  // Remember the last child so the copy doesn't blank out during the close animation.
  const [shown, setShown] = useState<Child | null>(child);
  if (child && child !== shown) setShown(child);
  const name = shown?.displayName ?? "";

  async function handleDelete() {
    if (!child) return;
    setPending(true);
    try {
      await deleteChild(child.id);
      toast.success(`Deleted ${child.displayName} and their songs`);
      onDeleted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that child. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={!!child} onOpenChange={(open) => !open && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            All of {name}&apos;s personalized songs will be deleted too, along with their name, pronunciation and
            age band. Deleted songs can&apos;t be recovered.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep {name}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Deleting…" : `Delete ${name} and their songs`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
