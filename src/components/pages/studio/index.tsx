"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChildren } from "@/hooks/api/useChildren";
import { useSongs } from "@/hooks/api/useSongs";
import { isInProgress } from "@/lib/api/songs";
import type { SongStatus } from "@/lib/api/types";
import { SongList } from "./SongList";

type Filter = "all" | "in_progress" | Extract<SongStatus, "pending_review" | "ready" | "rejected" | "failed">;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in_progress", label: "In progress" },
  { value: "pending_review", label: "Needs review" },
  { value: "ready", label: "Ready" },
  { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
];

// Client-side by necessity: the bearer token lives in browser memory.
export function StudioPage() {
  const [filter, setFilter] = useState<Filter>("all");
  // Single statuses filter on the server; "In progress" spans six statuses, so it filters the full list here.
  const serverStatus = filter === "all" || filter === "in_progress" ? undefined : filter;
  const { songs, error, isLoading, mutate } = useSongs(serverStatus);
  const { children } = useChildren();

  const visible = filter === "in_progress" ? songs?.filter((s) => isInProgress(s.status)) : songs;
  const sorted = visible?.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  const childNames = new Map(children?.map((c) => [c.id, c.displayName]));

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Songs</h1>
          <p className="text-sm text-muted-foreground">You listen first. Only songs you approve reach the player.</p>
        </div>
        <Link href="/studio/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" />
          New song
        </Link>
      </header>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList aria-label="Filter songs by status">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value} className="px-3">
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value={filter} className="pt-2">
          <SongList
            items={sorted}
            isLoading={isLoading}
            error={error}
            filtered={filter !== "all"}
            childNames={childNames}
            onRetry={() => mutate()}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}
