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
import { revokeInvite } from "@/lib/api/invites";
import type { Invite } from "@/lib/api/types";

type Props = { invite: Invite | null; onClose: () => void; onRevoked: () => void };

export function RevokeInviteDialog({ invite, onClose, onRevoked }: Props) {
  const [pending, setPending] = useState(false);
  // Keep the last invite so the copy doesn't blank out during the close animation.
  const [shown, setShown] = useState<Invite | null>(invite);
  if (invite && invite !== shown) setShown(invite);
  const email = shown?.email ?? "";

  async function handleRevoke() {
    if (!invite) return;
    setPending(true);
    try {
      await revokeInvite(invite.id);
      toast.success(`Revoked the invite for ${invite.email}`);
      onRevoked();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't revoke that invite. Please try again.");
      onRevoked(); // it may have been used or expired meanwhile
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={!!invite} onOpenChange={(open) => !open && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke the invite for {email}?</AlertDialogTitle>
          <AlertDialogDescription>
            The link stops working right away. You can make a new invite for this email later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleRevoke} disabled={pending}>
            {pending ? "Revoking…" : "Revoke invite"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
