import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SongCover } from "@/components/songs/SongCover";
import type { AdminStats } from "@/lib/api/types";
import { formatCount } from "./format";

/** Top 20 shared (or the admin's own) songs. Covers come through the authenticated media hook. */
export function TopSongs({ songs }: { songs: AdminStats["topSongs"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-bold">Top songs</CardTitle>
      </CardHeader>
      <CardContent>
        {songs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No song plays in this range.</p>
        ) : (
          <Table aria-label="Top songs">
            <TableHeader>
              <TableRow>
                <TableHead>Song</TableHead>
                <TableHead className="text-right">Plays</TableHead>
                <TableHead className="text-right">Families</TableHead>
                <TableHead className="text-right">In players</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {songs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="max-w-0 min-w-36 w-full">
                    <div className="flex items-center gap-3">
                      <SongCover imageUrl={s.imageUrl} alt="" className="size-9 rounded-lg" />
                      <span className="truncate font-semibold">{s.title ?? "Untitled song"}</span>
                      {s.mine && (
                        <Badge variant="secondary" className="shrink-0">
                          Yours
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(s.plays)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(s.families)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(s.libraryAdds)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
