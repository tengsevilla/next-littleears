import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { Song } from "@/lib/api/types";

export function SongSafety({ safety }: { safety: NonNullable<Song["safety"]> }) {
  if (safety.pass) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <ShieldCheck aria-hidden className="size-4 text-emerald-700 dark:text-emerald-400" />
        Passed the safety check.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <ShieldAlert aria-hidden className="size-4" />
        Didn&apos;t pass the safety check
      </p>
      {safety.reasons.length > 0 && (
        <ul className="ml-6 list-disc text-muted-foreground">
          {safety.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
