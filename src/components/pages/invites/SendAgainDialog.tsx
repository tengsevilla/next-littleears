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
import { createInvite, inviteErrorMessage } from "@/lib/api/invites";
import type { CreatedInvite, Invite } from "@/lib/api/types";

type Props = {
  invite: Invite | null;
  onClose: () => void;
  onSent: (created: CreatedInvite) => void;
  /** Refresh the list even on failure: the invite may have been used meanwhile. */
  onSettled: () => void;
};

/** "Send again" = POST /api/invites with the same email: the backend revokes the older pending invite. */
export function SendAgainDialog({ invite, onClose, onSent, onSettled }: Props) {
  const [pending, setPending] = useState(false);
  // Keep the last invite so the copy doesn't blank out during the close animation.
  const [shown, setShown] = useState<Invite | null>(invite);
  if (invite && invite !== shown) setShown(invite);
  const email = shown?.email ?? "";
  const wasPending = shown?.status === "pending";

  async function handleSend(event: React.MouseEvent) {
    event.preventDefault(); // keep the dialog open until the request settles
    if (!invite) return;
    setPending(true);
    try {
      onSent(await createInvite(invite.email));
      onClose();
    } catch (err) {
      toast.error(inviteErrorMessage(err));
    } finally {
      setPending(false);
      onSettled();
    }
  }

  return (
    <AlertDialog open={!!invite} onOpenChange={(open) => !open && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send a new invite to {email}?</AlertDialogTitle>
          <AlertDialogDescription>
            {wasPending
              ? "We'll email them a fresh link that lasts 7 days. The link you sent before stops working right away."
              : "We'll email them a fresh link that lasts 7 days. The old link has expired and stays that way."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSend} disabled={pending}>
            {pending ? "Sending…" : "Send new invite"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
