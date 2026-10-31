"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export const HOLD_MS = 3000;
const isHoldKey = (key: string) => key === " " || key === "Enter";

/**
 * Corner lock: hold for 3 s (pointer, or Space/Enter for keyboard users) to open the parent menu.
 * Releasing, sliding off or a cancelled touch resets it, and a tap does nothing; toddlers tap, they rarely hold.
 */
export function ParentGate({ onUnlock, night }: { onUnlock: () => void; night: boolean }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);

  function begin() {
    if (timer.current !== null) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onUnlock();
    }, HOLD_MS);
  }

  function reset() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <button
      type="button"
      aria-label="Grown-ups: press and hold for 3 seconds"
      onPointerDown={(e) => {
        if (e.button === 0) begin();
      }}
      onPointerUp={reset}
      onPointerLeave={reset}
      onPointerCancel={reset}
      onBlur={reset}
      onKeyDown={(e) => {
        if (!isHoldKey(e.key)) return;
        e.preventDefault();
        if (!e.repeat) begin();
      }}
      onKeyUp={(e) => {
        if (isHoldKey(e.key)) reset();
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "relative flex size-24 shrink-0 touch-none items-center justify-center rounded-full outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-4",
        night
          ? "bg-white/5 text-amber-100/40 focus-visible:ring-amber-200/60"
          : "bg-stone-900/5 text-stone-900/35 focus-visible:ring-sky",
      )}
    >
      <Lock aria-hidden className="size-8" />
      <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
        <circle
          data-holding={holding || undefined}
          cx="50"
          cy="50"
          r="45"
          pathLength={100}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className={cn(
            "stroke-primary [stroke-dasharray:100]",
            holding
              ? "transition-[stroke-dashoffset] duration-[3000ms] ease-linear [stroke-dashoffset:0]"
              : "[stroke-dashoffset:100]",
          )}
        />
      </svg>
    </button>
  );
}
