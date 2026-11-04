import type { AdminStats } from "@/lib/api/types";
import { formatCount } from "./format";

/** Headline numbers: one tile each, the value as the hero, in plain ink. */
export function StatTiles({ totals }: { totals: AdminStats["totals"] }) {
  const tiles = [
    { label: "Total plays", value: formatCount(totals.plays) },
    { label: "Song plays", value: formatCount(totals.songPlays) },
    { label: "Sound plays", value: formatCount(totals.soundPlays) },
    {
      label: "Active families",
      value: `${formatCount(totals.activeFamilies)} of ${formatCount(totals.families)}`,
      hint: "played at least once",
    },
    { label: "Songs created", value: formatCount(totals.songsCreated) },
    { label: "Shared songs", value: formatCount(totals.sharedSongs), hint: "in the catalog now" },
  ];

  return (
    <dl aria-label="Totals" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col gap-1 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <dt className="text-xs font-semibold text-muted-foreground">{t.label}</dt>
          <dd className="text-2xl font-extrabold tracking-tight tabular-nums">{t.value}</dd>
          {t.hint && <dd className="text-xs text-muted-foreground">{t.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
