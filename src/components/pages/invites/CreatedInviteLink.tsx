"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Copy, MailCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CreatedInvite } from "@/lib/api/types";
import { cn, formatDate } from "@/lib/utils";

/**
 * Result of POST /api/invites. The raw link exists only in this response, so it is shown once and never stored:
 * tucked behind a disclosure when the email went out, visible straight away when it didn't.
 */
export function CreatedInviteLink({ invite, onDone }: { invite: CreatedInvite; onDone: () => void }) {
  const sent = invite.emailStatus === "sent";
  const ref = useRef<HTMLDivElement>(null);

  // The panel can appear from "Send again" further down the list, so bring it into view and announce it.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const expiry = formatDate(invite.expiresAt);

  return (
    <Card
      ref={ref}
      tabIndex={-1}
      role="region"
      aria-label="New invite"
      data-email-status={invite.emailStatus}
      className={cn(
        "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        sent ? "border-meadow/60 bg-meadow/10" : "border-sunshine bg-sunshine/15",
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-start gap-2">
          {sent ? (
            <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
          ) : (
            <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
          )}
          <span className="min-w-0 break-words">
            {sent ? `Invite emailed to ${invite.email}` : "We couldn't send the email. Copy this link and send it yourself."}
          </span>
        </CardTitle>
        <CardDescription>
          {sent
            ? `They'll get a link that works once and expires ${expiry}.`
            : `It's for ${invite.email}. You'll only see it now, it works once, and it expires ${expiry}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sent ? (
          <details className="group text-sm">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-md font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
              Copy link instead
            </summary>
            <p className="mt-2 text-muted-foreground">
              If the email doesn&apos;t arrive, send them this link yourself. You&apos;ll only see it now.
            </p>
            <LinkRow url={invite.inviteUrl} className="mt-2" />
          </details>
        ) : (
          <LinkRow url={invite.inviteUrl} />
        )}
        <Button variant="outline" onClick={onDone} className="self-end">
          Done
        </Button>
      </CardContent>
    </Card>
  );
}

function LinkRow({ url, className }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy automatically. Select the link and copy it yourself.");
    }
  }

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row", className)}>
      <Input
        readOnly
        aria-label="Invite link"
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="font-mono text-xs"
      />
      <Button onClick={copy} className="shrink-0">
        {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
