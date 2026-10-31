import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Invite, InviteStatus } from "@/lib/api/types";
import { cn, formatDate } from "@/lib/utils";

const STATUS_META: Record<InviteStatus, { label: string; className: string }> = {
  pending: { label: "Waiting", className: "bg-sunshine/45 text-amber-950 dark:bg-sunshine/25 dark:text-amber-100" },
  used: { label: "Joined", className: "bg-meadow/40 text-emerald-950 dark:bg-meadow/25 dark:text-emerald-100" },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground" },
  revoked: { label: "Revoked", className: "bg-destructive/10 text-destructive dark:bg-destructive/20" },
};

type Props = {
  items: Invite[] | undefined;
  isLoading: boolean;
  error: Error | undefined;
  onRetry: () => void;
  onRevoke: (invite: Invite) => void;
  onSendAgain: (invite: Invite) => void;
};

export function InviteList({ items, isLoading, error, onRetry, onRevoke, onSendAgain }: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading invites">
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
          <p role="alert">We couldn&apos;t load your invites: {error.message}</p>
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
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No invites yet. Each family you invite shows up here, with whether they&apos;ve joined.
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Invites">
      {items.map((invite) => {
        const { label, className } = STATUS_META[invite.status];
        return (
          <li key={invite.id}>
            <Card className="py-0">
              <CardContent className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-bold">{invite.email}</span>
                    <Badge data-status={invite.status} className={cn("font-semibold", className)}>
                      {label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sent <time dateTime={invite.createdAt}>{formatDate(invite.createdAt)}</time>
                    {invite.status === "pending" && (
                      <>
                        {" · Expires "}
                        <time dateTime={invite.expiresAt}>{formatDate(invite.expiresAt)}</time>
                      </>
                    )}
                  </p>
                </div>
                {(invite.status === "pending" || invite.status === "expired") && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Send the invite for ${invite.email} again`}
                    onClick={() => onSendAgain(invite)}
                  >
                    Send again
                  </Button>
                )}
                {invite.status === "pending" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Revoke invite for ${invite.email}`}
                    onClick={() => onRevoke(invite)}
                  >
                    Revoke
                  </Button>
                )}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
