import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { isInProgress } from "@/lib/api/songs";
import type { SongStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const IN_PROGRESS_STYLE = "bg-sky/25 text-sky-950 dark:bg-sky/20 dark:text-sky-100";

export const STATUS_META: Record<SongStatus, { label: string; className: string }> = {
  queued: { label: "Waiting to start", className: IN_PROGRESS_STYLE },
  writing: { label: "Writing lyrics", className: IN_PROGRESS_STYLE },
  checking: { label: "Safety check", className: IN_PROGRESS_STYLE },
  composing: { label: "Composing music", className: IN_PROGRESS_STYLE },
  illustrating: { label: "Drawing the cover", className: IN_PROGRESS_STYLE },
  mixing: { label: "Mixing", className: IN_PROGRESS_STYLE },
  pending_review: {
    label: "Needs your review",
    className: "bg-sunshine/45 text-amber-950 dark:bg-sunshine/25 dark:text-amber-100",
  },
  ready: { label: "Ready to play", className: "bg-meadow/40 text-emerald-950 dark:bg-meadow/25 dark:text-emerald-100" },
  rejected: { label: "Rejected", className: "bg-muted text-muted-foreground" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive dark:bg-destructive/20" },
};

export function SongStatusBadge({ status, className }: { status: SongStatus; className?: string }) {
  const { label, className: tone } = STATUS_META[status];
  return (
    <Badge data-status={status} className={cn("font-semibold", tone, className)}>
      {isInProgress(status) && <Spinner aria-hidden aria-label={undefined} role={undefined} data-icon="inline-start" />}
      {label}
    </Badge>
  );
}
