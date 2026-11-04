"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { AdminStats } from "@/lib/api/types";
import { formatCount, formatDay } from "./format";

// Categorical slots 1 and 2 of the dataviz reference palette (blue, orange), each stepped for its surface.
// Validated as an adjacent pair in both modes; identity is never colour-alone (legend + tooltip labels).
const config = {
  songPlays: { label: "Songs", theme: { light: "#2a78d6", dark: "#3987e5" } },
  soundPlays: { label: "Sounds", theme: { light: "#eb6834", dark: "#d95926" } },
} satisfies ChartConfig;

/** Plays per day, songs vs sounds: two 2px lines on one axis, crosshair tooltip, legend, and a table view. */
export function PlaysChart({ daily }: { daily: AdminStats["daily"] }) {
  return (
    <div className="flex flex-col gap-3">
      <ChartContainer config={config} className="aspect-auto h-64 w-full" role="img" aria-label="Plays per day, songs and sounds">
        <LineChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={formatDay} />
          <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent indicator="line" labelFormatter={(d) => formatDay(String(d))} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Line dataKey="songPlays" type="monotone" stroke="var(--color-songPlays)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line dataKey="soundPlays" type="monotone" stroke="var(--color-soundPlays)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ChartContainer>
      <details className="text-sm">
        <summary className="cursor-pointer w-fit text-muted-foreground hover:text-foreground">Show as a table</summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-semibold">Day</th>
                <th className="py-1 text-right font-semibold">Songs</th>
                <th className="py-1 text-right font-semibold">Sounds</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.date} className="border-t">
                  <td className="py-1">{formatDay(d.date)}</td>
                  <td className="py-1 text-right">{formatCount(d.songPlays)}</td>
                  <td className="py-1 text-right">{formatCount(d.soundPlays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
