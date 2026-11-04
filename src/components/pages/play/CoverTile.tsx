"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Soft background colours for a tile whose cover isn't there (yet). */
export const TILE_PLACEHOLDER = ["bg-sunshine", "bg-sky", "bg-meadow", "bg-primary"] as const;

/**
 * The shared kid-player tile (songs and sounds): a big square button with no visible text. The accessible
 * name is the title, for screen readers only. `active` shows the playing state with a bouncing badge.
 */
export function CoverTile({
  label,
  active,
  night,
  badgeIcon: Badge,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  /** Bedtime: softer, darker tiles. */
  night: boolean;
  badgeIcon: LucideIcon;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative aspect-square min-h-24 w-full overflow-hidden rounded-[2rem] shadow-lg ring-4 ring-black/10 transition-transform duration-300 outline-none focus-visible:ring-8 focus-visible:ring-sky active:scale-95",
        night && !active && "brightness-[0.7] saturate-[0.8]",
        active && "z-10 scale-[1.04] shadow-2xl ring-8 ring-sunshine",
      )}
    >
      {children}
      {active && (
        <span
          aria-hidden
          className="absolute right-3 bottom-3 flex size-14 animate-bounce items-center justify-center rounded-full bg-sunshine text-stone-900 shadow-lg [animation-duration:1.6s]"
        >
          <Badge className="size-7" />
        </span>
      )}
    </button>
  );
}

/** Coloured square with a big icon, shown while a cover loads or when it is missing. */
export function TilePlaceholder({ icon: Icon, index, pulse }: { icon: LucideIcon; index: number; pulse?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-full items-center justify-center text-stone-900/50",
        TILE_PLACEHOLDER[index % TILE_PLACEHOLDER.length],
        pulse && "animate-pulse",
      )}
    >
      <Icon className="size-1/3" />
    </span>
  );
}
