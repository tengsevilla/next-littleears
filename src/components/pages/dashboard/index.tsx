"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudioUser } from "@/components/layout/StudioUser";
import { useAdminStats } from "@/hooks/api/useAdminStats";
import { ApiClientError } from "@/lib/api/apiClient";
import { STATS_RANGES } from "@/lib/api/plays";
import type { StatsRange } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { formatCount } from "./format";
import { StatTiles } from "./StatTiles";
import { TopSongs } from "./TopSongs";
import { TopSounds } from "./TopSounds";

// Recharts is the heaviest thing in the studio and only the admin's dashboard needs it.
const PlaysChart = dynamic(() => import("./PlaysChart").then((m) => m.PlaysChart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

// Admin only. The link in the nav is hidden for parents; the API is the real gate (403 FORBIDDEN).
export function DashboardPage() {
  const user = useStudioUser();
  const isAdmin = user.role === "admin";
  const [range, setRange] = useState<StatsRange>("30d");
  const { stats, error, isLoading, isValidating, mutate } = useAdminStats(range, isAdmin);

  if (!isAdmin || (error instanceof ApiClientError && error.code === "FORBIDDEN")) return <NotAvailable />;

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">How families are listening. A play counts after 10 seconds.</p>
        </div>
        <RangeSwitch value={range} onChange={setRange} />
      </header>

      {error && !stats ? (
        <Card>
          <CardContent role="alert" className="flex flex-col items-start gap-3 text-sm">
            <p className="font-semibold">We couldn&apos;t load the dashboard.</p>
            <p className="text-muted-foreground">Check your connection and try again.</p>
            <Button variant="outline" size="sm" onClick={() => mutate()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : isLoading || !stats ? (
        <DashboardSkeleton />
      ) : (
        // While another range loads, the previous one stays on screen, dimmed.
        <div aria-busy={isValidating} className={cn("flex flex-col gap-6 transition-opacity", isValidating && "opacity-60")}>
          <StatTiles totals={stats.totals} />
          {stats.totals.plays === 0 ? (
            <EmptyPlays />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="font-bold">Plays per day</CardTitle>
                  <CardDescription>Song and sound plays by day (UTC)</CardDescription>
                </CardHeader>
                <CardContent>
                  <PlaysChart daily={stats.daily} />
                </CardContent>
              </Card>
              <TopSongs songs={stats.topSongs} />
              <p className="text-sm text-muted-foreground">
                Personalized songs:{" "}
                <span className="font-semibold text-foreground tabular-nums">{formatCount(stats.personalizedPlays)}</span>{" "}
                {stats.personalizedPlays === 1 ? "play" : "plays"}{" "}
                <span className="text-xs">(other families&apos; songs made for a child; titles stay private)</span>
              </p>
              <TopSounds sounds={stats.topSounds} />
            </>
          )}
        </div>
      )}
    </main>
  );
}

function RangeSwitch({ value, onChange }: { value: StatsRange; onChange: (r: StatsRange) => void }) {
  return (
    <div role="group" aria-label="Date range" className="inline-flex w-fit rounded-lg bg-muted p-[3px]">
      {STATS_RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          aria-pressed={value === r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-semibold text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            value === r.value && "bg-background text-foreground shadow-sm dark:bg-input/40",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function EmptyPlays() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm">
        <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-sky/30">
          <BarChart3 className="size-6" />
        </span>
        <h2 className="font-semibold">No plays yet</h2>
        <p className="max-w-sm text-muted-foreground">
          Counting starts from now. Plays show up here once a song or sound has played for 10 seconds in the kid player.
        </p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading the dashboard" className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
      <Skeleton className="h-48" />
    </div>
  );
}

function NotAvailable() {
  return (
    <main className="flex flex-1 flex-col">
      <Card>
        <CardContent className="flex flex-col items-start gap-3 text-sm">
          <h1 className="text-lg font-bold">The dashboard isn&apos;t available on your account</h1>
          <p className="text-muted-foreground">
            Only the LittleEars admin can see listening stats. Your songs and children are all still here.
          </p>
          <Link href="/studio" className={buttonVariants({ variant: "outline" })}>
            Back to songs
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
