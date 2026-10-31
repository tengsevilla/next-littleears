"use client";

import Link from "next/link";
import { Music, UserRound } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Reachable only through the 3-second gate, so the kid view has no way out and no menu to wander into. */
export function ParentMenu({
  open,
  onOpenChange,
  emptyLibrary,
  onChangeChild,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emptyLibrary: boolean;
  onChangeChild: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extrabold">Grown-ups</DialogTitle>
          <DialogDescription className="text-base">
            {emptyLibrary
              ? "No songs here yet. Approve a song in the studio and it will show up in the player."
              : "Leave the player, or choose who it plays for."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Link href="/studio" className={cn(buttonVariants({ size: "lg" }), "h-14 text-base")}>
            <Music data-icon="inline-start" />
            Back to studio
          </Link>
          <Button variant="outline" size="lg" className="h-14 text-base" onClick={onChangeChild}>
            <UserRound data-icon="inline-start" />
            Change child
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
