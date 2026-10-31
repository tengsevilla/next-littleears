"use client";

import { Music } from "lucide-react";
import { useKidSession } from "@/hooks/common/useKidSession";
import { PlayerApp } from "./PlayerApp";

// The kid player sits outside the studio shell: no header, no links out. It needs the parent's refresh
// cookie (401 → /login?next=/play); with no network it runs from the service worker's cache, token-less.
export function PlayPage() {
  const session = useKidSession();

  if (session === "checking") {
    return (
      <main role="status" aria-label="Loading" className="flex min-h-dvh flex-1 items-center justify-center bg-stone-900">
        <span aria-hidden className="flex size-28 animate-pulse items-center justify-center rounded-full bg-sunshine text-stone-900">
          <Music className="size-14" />
        </span>
      </main>
    );
  }
  return <PlayerApp offline={session === "offline"} />;
}
