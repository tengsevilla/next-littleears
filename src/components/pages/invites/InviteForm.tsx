"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createInvite, inviteErrorMessage, inviteFormSchema } from "@/lib/api/invites";
import type { CreatedInvite } from "@/lib/api/types";

export function InviteForm({ onCreated }: { onCreated: (invite: CreatedInvite) => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = inviteFormSchema.safeParse({ email: email.trim() });
    if (!parsed.success) {
      setError(z.flattenError(parsed.error).fieldErrors.email?.[0] ?? "Please check the email address.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      onCreated(await createInvite(parsed.data.email));
      setEmail("");
    } catch (err) {
      setError(inviteErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <form method="post" onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Field data-invalid={!!error || undefined} className="flex-1">
            <FieldLabel htmlFor="invite-email">Email to invite</FieldLabel>
            <Input
              id="invite-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="grown-up@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error || undefined}
            />
            <FieldError>{error}</FieldError>
          </Field>
          <Button type="submit" disabled={pending} className="sm:mt-6">
            {pending ? "Sending…" : "Send invite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
