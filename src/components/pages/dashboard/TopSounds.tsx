import { AudioWaveform } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminStats } from "@/lib/api/types";
import { SOUNDS } from "@/lib/sounds";
import { formatCount } from "./format";

const BY_SLUG = new Map(SOUNDS.map((s) => [s.slug, s]));

/** Every sound played in the range. Cover and title come from the manifest; an unknown slug shows as itself. */
export function TopSounds({ sounds }: { sounds: AdminStats["topSounds"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-bold">Top sounds</CardTitle>
      </CardHeader>
      <CardContent>
        {sounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sound plays in this range.</p>
        ) : (
          <Table aria-label="Top sounds">
            <TableHeader>
              <TableRow>
                <TableHead>Sound</TableHead>
                <TableHead className="text-right">Plays</TableHead>
                <TableHead className="text-right">Families</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sounds.map((row) => {
                const sound = BY_SLUG.get(row.slug);
                return (
                  <TableRow key={row.slug}>
                    <TableCell className="max-w-0 min-w-36 w-full">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sky/30">
                          {sound ? (
                            // A static, versioned asset under /sounds/ (the SW caches it); same as the kid player's tiles.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={sound.cover} alt="" className="size-full object-cover" />
                          ) : (
                            <AudioWaveform aria-hidden className="size-4" />
                          )}
                        </span>
                        <span className="truncate font-semibold">{sound?.title ?? row.slug}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(row.plays)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(row.families)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
