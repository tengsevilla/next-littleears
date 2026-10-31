"use client";

import { MoonStar } from "lucide-react";

/** After a lullaby ends the screen goes almost dark; any tap brings it back. */
export function SleepOverlay({ onWake }: { onWake: () => void }) {
  return (
    <button
      type="button"
      aria-label="Wake up the player"
      onClick={onWake}
      className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/95 text-amber-100/15 outline-none animate-in fade-in-0 duration-[3000ms]"
    >
      <MoonStar aria-hidden className="size-24" />
    </button>
  );
}
