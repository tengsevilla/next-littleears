"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStudioUser } from "@/components/layout/StudioUser";
import { useInvites } from "@/hooks/api/useInvites";
import { ApiClientError } from "@/lib/api/apiClient";
import type { CreatedInvite, Invite } from "@/lib/api/types";
import { CreatedInviteLink } from "./CreatedInviteLink";
import { InviteForm } from "./InviteForm";
import { InviteList } from "./InviteList";
import { RevokeInviteDialog } from "./RevokeInviteDialog";
import { SendAgainDialog } from "./SendAgainDialog";

// Admin only. The link in the nav is hidden for parents; the API is the real gate (403 FORBIDDEN).
export function InvitesPage() {
  const user = useStudioUser();
  const isAdmin = user.role === "admin";
  const { invites, error, isLoading, mutate } = useInvites(isAdmin);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [revoking, setRevoking] = useState<Invite | null>(null);
  const [resending, setResending] = useState<Invite | null>(null);

  if (!isAdmin || (error instanceof ApiClientError && error.code === "FORBIDDEN")) return <NotAvailable />;

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Invites</h1>
        <p className="text-sm text-muted-foreground">
          LittleEars is invite only. Enter a family&apos;s email and we&apos;ll send them a sign-up link that works once and lasts 7 days.
        </p>
      </header>

      <InviteForm
        onCreated={(invite) => {
          setCreated(invite);
          void mutate();
        }}
      />
      {created && <CreatedInviteLink key={created.id} invite={created} onDone={() => setCreated(null)} />}

      <section aria-labelledby="invite-list-heading" className="flex flex-col gap-3">
        <h2 id="invite-list-heading" className="text-lg font-bold">
          Sent invites
        </h2>
        <InviteList
          items={invites}
          isLoading={isLoading}
          error={error}
          onRetry={() => mutate()}
          onRevoke={setRevoking}
          onSendAgain={setResending}
        />
      </section>

      <RevokeInviteDialog invite={revoking} onClose={() => setRevoking(null)} onRevoked={() => mutate()} />
      <SendAgainDialog
        invite={resending}
        onClose={() => setResending(null)}
        onSent={setCreated}
        onSettled={() => void mutate()}
      />
    </main>
  );
}

function NotAvailable() {
  return (
    <main className="flex flex-1 flex-col">
      <Card>
        <CardContent className="flex flex-col items-start gap-3 text-sm">
          <h1 className="text-lg font-bold">Invites aren&apos;t available on your account</h1>
          <p className="text-muted-foreground">
            Only the LittleEars admin can invite new families. Your songs and children are all still here.
          </p>
          <Link href="/studio" className={buttonVariants({ variant: "outline" })}>
            Back to songs
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
