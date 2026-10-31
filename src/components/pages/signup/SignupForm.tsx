"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useInviteEmail } from "@/hooks/api/useInviteEmail";
import { ApiClientError } from "@/lib/api/apiClient";
import { register } from "@/lib/auth";

const signupSchema = z
  .object({
    password: z.string().min(10, "Use at least 10 characters.").max(128, "Keep it to 128 characters or fewer."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." });

type FieldErrors = Partial<Record<keyof z.infer<typeof signupSchema>, string>>;

/** Reads the invite token once, then removes it from the address bar and history. undefined = not read yet. */
function useInviteToken(): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("token");
    if (fromUrl !== null) {
      url.searchParams.delete("token");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    // StrictMode re-runs this effect after the URL is already clean: keep the token read the first time.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the token only exists in the browser URL
    setToken((prev) => prev ?? fromUrl);
  }, []);
  return token;
}

export function SignupForm() {
  const token = useInviteToken();
  const { email, error } = useInviteEmail(token ?? null);
  const [used, setUsed] = useState(false);

  if (token === undefined || (token && !email && !error && !used)) {
    return (
      <div role="status" aria-label="Checking your invite" className="flex flex-col gap-3">
        <Skeleton className="h-9 rounded-lg" />
        <Skeleton className="h-9 rounded-lg" />
      </div>
    );
  }
  // One message for unknown, expired, used and malformed links (the API doesn't tell them apart either).
  const invalid = !token || used || (error instanceof ApiClientError && (error.status === 404 || error.status === 400));
  if (invalid || !email) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {invalid
            ? "This invite link doesn't work any more. It may have expired or already been used. Ask the person who invited you for a new link."
            : "We couldn't check your invite just now. Check your connection and open the link again."}
        </p>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          I already have an account
        </Link>
      </div>
    );
  }
  return <PasswordForm token={token} email={email} onInvalid={() => setUsed(true)} />;
}

function friendlyError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code === "RATE_LIMITED") return "Too many tries. Please wait a few minutes and try again.";
    return err.message;
  }
  return "We couldn't reach LittleEars just now. Check your connection and try again.";
}

function PasswordForm({ token, email, onInvalid }: { token: string; email: string; onInvalid: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = signupSchema.safeParse({ password: form.get("password"), confirm: form.get("confirm") });
    setFormError(null);
    setConflict(false);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setFieldErrors({ password: flat.password?.[0], confirm: flat.confirm?.[0] });
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      await register(token, parsed.data.password);
      router.replace("/studio");
    } catch (err) {
      setPending(false);
      if (err instanceof ApiClientError && err.code === "NOT_FOUND") onInvalid();
      else if (err instanceof ApiClientError && err.code === "CONFLICT") setConflict(true);
      else setFormError(friendlyError(err));
    }
  }

  return (
    // method="post": a native submit (before hydration, or with JS off) sends the fields in the request body,
    // never in the URL. The invite token is not a form field. With JS, handleSubmit prevents the native submit.
    <form method="post" onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="username" value={email} readOnly />
          <FieldDescription>Your invite is for this address.</FieldDescription>
        </Field>
        <Field data-invalid={!!fieldErrors.password || undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            required
            aria-invalid={!!fieldErrors.password || undefined}
          />
          <FieldDescription>At least 10 characters.</FieldDescription>
          <FieldError>{fieldErrors.password}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.confirm || undefined}>
          <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            required
            aria-invalid={!!fieldErrors.confirm || undefined}
          />
          <FieldError>{fieldErrors.confirm}</FieldError>
        </Field>
        {(formError || conflict) && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {conflict ? (
              <>
                There&apos;s already an account for this email.{" "}
                <Link href="/login" className="font-semibold underline">
                  Sign in instead
                </Link>
              </>
            ) : (
              formError
            )}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Creating your account…" : "Continue to the studio"}
        </Button>
      </FieldGroup>
    </form>
  );
}
