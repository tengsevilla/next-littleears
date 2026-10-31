import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AGE_BANDS } from "@/lib/api/children";
import type { Child } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { NamePreviewButton } from "./NamePreview";

const AVATAR_COLORS = ["bg-sunshine", "bg-sky", "bg-meadow"] as const;
const AGE_LABEL = new Map(AGE_BANDS.map((b) => [b.value, b.label]));

type Props = {
  items: Child[] | undefined;
  isLoading: boolean;
  error: Error | undefined;
  onRetry: () => void;
  onAdd: () => void;
  onEdit: (child: Child) => void;
  onDelete: (child: Child) => void;
};

export function ChildrenList({ items, isLoading, error, onRetry, onAdd, onEdit, onDelete }: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading children">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error && !items) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p role="alert">We couldn&apos;t load your children: {error.message}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!items?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="font-semibold">No children yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Add a name and age, and every new song can be made just for them.
          </p>
          <Button onClick={onAdd}>Add your first child</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Children">
      {items.map((child, i) => (
        <li key={child.id}>
          <Card className="py-0">
            <CardContent className="flex items-center gap-3 px-3 py-3 sm:px-4">
              <span
                aria-hidden
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-stone-900",
                  AVATAR_COLORS[i % AVATAR_COLORS.length],
                )}
              >
                {child.displayName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-bold">{child.displayName}</span>
                  <Badge variant="secondary">{AGE_LABEL.get(child.ageBand) ?? child.ageBand}</Badge>
                </div>
                {child.phoneticName && (
                  <p className="truncate text-sm text-muted-foreground">Say it: {child.phoneticName}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <NamePreviewButton child={child} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${child.displayName}`}
                  onClick={() => onEdit(child)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${child.displayName}`}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onDelete(child)}
                >
                  <Trash2 />
                </Button>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
