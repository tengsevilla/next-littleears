"use client";

import { createContext, use, useEffect, useRef, useState } from "react";
import { Loader2, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/apiClient";
import { getNamePreview } from "@/lib/api/children";
import type { Child } from "@/lib/api/types";

type Status = "loading" | "playing";
type Active = { childId: string; status: Status } | null;
type Ctx = { active: Active; toggle: (child: Child) => void };

const NamePreviewContext = createContext<Ctx | null>(null);

/** The clip depends on exactly these fields, so a change to either invalidates the cached clip. */
const clipKey = (child: Child) => `${child.displayName}\u0000${child.phoneticName ?? ""}`;

function errorMessage(err: unknown): string {
  const code = err instanceof ApiClientError ? err.code : "";
  if (code === "RATE_LIMITED") return "You've heard a lot of names just now. Please try again in a minute.";
  if (code.startsWith("PROVIDER_")) return "Our voice helper is taking a short break. Please try again soon.";
  return "We couldn't play that name. Please try again.";
}

/**
 * One shared <audio> for the whole page, so only one clip ever plays at a time,
 * plus an in-memory cache (one clip per child) so repeat clicks don't re-call the API.
 */
export function NamePreviewProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Active>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef(new Map<string, { key: string; url: string }>());
  const requestRef = useRef(0); // bumps on every click; a stale fetch/play can't take over

  useEffect(() => () => audioRef.current?.pause(), []);

  function stop() {
    requestRef.current++;
    audioRef.current?.pause();
    setActive(null);
  }

  async function toggle(child: Child) {
    if (active?.childId === child.id) return stop();
    stop();
    const request = requestRef.current;
    const key = clipKey(child);
    const cached = cacheRef.current.get(child.id);
    try {
      let url = cached?.key === key ? cached.url : null;
      if (!url) {
        setActive({ childId: child.id, status: "loading" });
        url = await getNamePreview(child.id);
        cacheRef.current.set(child.id, { key, url });
        if (request !== requestRef.current) return;
      }
      const audio = (audioRef.current ??= new Audio());
      audio.onended = () => request === requestRef.current && setActive(null);
      audio.src = url;
      setActive({ childId: child.id, status: "playing" });
      await audio.play();
    } catch (err) {
      if (request !== requestRef.current) return;
      setActive(null);
      toast.error(errorMessage(err));
    }
  }

  return <NamePreviewContext value={{ active, toggle }}>{children}</NamePreviewContext>;
}

export function NamePreviewButton({ child, withLabel = false }: { child: Child; withLabel?: boolean }) {
  const ctx = use(NamePreviewContext);
  if (!ctx) throw new Error("NamePreviewButton must be inside NamePreviewProvider");
  const status = ctx.active?.childId === child.id ? ctx.active.status : "idle";
  const label = `Hear how we say ${child.displayName}`;
  const Icon = status === "loading" ? Loader2 : status === "playing" ? Square : Volume2;

  // The accessible name stays the same in every state; aria-pressed / aria-busy carry the state.
  return (
    <Button
      type="button"
      variant={withLabel ? "outline" : "ghost"}
      size={withLabel ? "sm" : "icon-sm"}
      aria-label={withLabel ? undefined : label}
      aria-pressed={status === "playing"}
      aria-busy={status === "loading" || undefined}
      title={status === "playing" ? "Stop" : label}
      onClick={() => ctx.toggle(child)}
    >
      <Icon
        aria-hidden
        className={status === "loading" ? "animate-spin" : undefined}
        data-icon={withLabel ? "inline-start" : undefined}
      />
      {withLabel && label}
    </Button>
  );
}
