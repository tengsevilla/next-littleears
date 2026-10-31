"use client";

import { CloudOff, Users } from "lucide-react";
import { useChildren } from "@/hooks/api/useChildren";
import type { PlayerChoice } from "@/lib/playerChoice";
import { cn } from "@/lib/utils";

const TILE_COLORS = ["bg-sunshine", "bg-sky", "bg-meadow", "bg-primary"] as const;

/**
 * Set-up screen the parent uses once per device. The only place in the player that shows a child's
 * displayName — the parent is the one reading it.
 */
export function ChildPicker({ offline, onPick }: { offline: boolean; onPick: (choice: PlayerChoice) => void }) {
  const { children, error, isLoading } = useChildren();

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center gap-10 bg-[oklch(0.97_0.03_85)] px-6 py-12 text-stone-900">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Who&apos;s listening?</h1>
        <p className="max-w-md text-lg text-stone-700">
          Pick once for this device. Grown-ups can change it later by holding the lock button.
        </p>
      </header>

      {offline || error ? (
        <div role="alert" className="flex max-w-sm flex-col items-center gap-4 text-center text-lg text-stone-700">
          <CloudOff aria-hidden className="size-16 text-primary" />
          We need the internet once to set up the player. Connect and reload this page.
        </div>
      ) : (
        <ul aria-busy={isLoading} className="grid w-full max-w-3xl grid-cols-2 gap-5 sm:grid-cols-3">
          {isLoading &&
            [0, 1, 2].map((i) => <li key={i} aria-hidden className="aspect-square animate-pulse rounded-[2rem] bg-stone-900/10" />)}
          {children?.map((child, i) => (
            <li key={child.id}>
              <PickTile
                className={TILE_COLORS[i % TILE_COLORS.length]}
                onClick={() => onPick({ childId: child.id, displayName: child.displayName })}
              >
                <span aria-hidden className="text-6xl font-black">
                  {child.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="line-clamp-2 text-2xl font-bold break-words">{child.displayName}</span>
              </PickTile>
            </li>
          ))}
          {children && (
            <li>
              <PickTile className="bg-white ring-4 ring-stone-900/10" onClick={() => onPick({ childId: null, displayName: "Everyone" })}>
                <Users aria-hidden className="size-16" />
                <span className="text-2xl font-bold">Everyone</span>
              </PickTile>
            </li>
          )}
        </ul>
      )}
    </main>
  );
}

function PickTile({ className, onClick, children }: { className: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex aspect-square min-h-24 w-full flex-col items-center justify-center gap-2 rounded-[2rem] p-4 text-center text-stone-900 shadow-md transition-transform outline-none hover:-translate-y-1 focus-visible:ring-8 focus-visible:ring-sky active:scale-95",
        className,
      )}
    >
      {children}
    </button>
  );
}
