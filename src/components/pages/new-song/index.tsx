"use client";

import { useEffect, useState } from "react";
import { NamePreviewProvider } from "@/components/pages/children/NamePreview";
import { useChildren } from "@/hooks/api/useChildren";
import type { SongFormValues } from "@/lib/api/songs";
import { NewSongForm } from "./NewSongForm";

export function NewSongPage({ prefill }: { prefill: Partial<SongFormValues> }) {
  const { children, isLoading, mutate } = useChildren();

  // Next keeps visited routes mounted in a hidden <Activity>, so form state (values, "Starting your song…")
  // would survive leaving and coming back. Effects re-run each time the route is revealed, so bump a visit
  // counter there and remount the form: every visit (nav link or Back) starts fresh, from the URL's prefill.
  const [visit, setVisit] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the route being revealed again
    setVisit((v) => v + 1);
  }, []);

  return (
    <NamePreviewProvider>
      <main className="flex flex-1 flex-col gap-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight">New song</h1>
          <p className="text-sm text-muted-foreground">
            Takes a couple of minutes. You&apos;ll listen and approve it before it reaches the player.
          </p>
        </header>
        <NewSongForm
          key={`${visit}:${JSON.stringify(prefill)}`}
          prefill={prefill}
          childList={children}
          childrenLoading={isLoading}
          onChildMissing={() => mutate()}
        />
      </main>
    </NamePreviewProvider>
  );
}
