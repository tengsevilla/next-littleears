"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/lib/api/apiClient";
import { login, safeNextPath } from "@/lib/auth";

const loginSchema = z.object({
  email: z.email("Enter the email you use for LittleEars."),
  password: z.string().min(1, "Enter your password."),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof loginSchema>, string>>;

function friendlyError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code === "INVALID_CREDENTIALS") return "That email and password don't match. Please try again.";
    return err.message;
  }
  return "We couldn't reach LittleEars just now. Check your connection and try again.";
}

const CREDENTIAL_PARAMS = ["email", "password"] as const;

export function LoginForm() {
  const router = useRouter();

  // Defense in depth: if credentials ever arrive in the query string (an old GET submit, a crafted link),
  // drop them from the address bar and history right away. They are never used to prefill the form.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!CREDENTIAL_PARAMS.some((p) => url.searchParams.has(p))) return;
    for (const p of CREDENTIAL_PARAMS) url.searchParams.delete(p);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    setFormError(null);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setFieldErrors({ email: flat.email?.[0], password: flat.password?.[0] });
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      await login(parsed.data.email, parsed.data.password);
      // Read `next` at submit time instead of subscribing to search params during render.
      router.replace(safeNextPath(new URLSearchParams(window.location.search).get("next")));
    } catch (err) {
      setFormError(friendlyError(err));
      setPending(false);
    }
  }

  return (
    // method="post": if this is submitted natively (before hydration, or with JS off), the browser sends the
    // fields in the request body to this same-origin page (keeping ?next), never in the URL. Next renders
    // the login page again for that POST and ignores the body. With JS, handleSubmit prevents the native submit.
    <form method="post" onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={!!fieldErrors.email || undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            aria-invalid={!!fieldErrors.email || undefined}
          />
          <FieldError>{fieldErrors.email}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.password || undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={!!fieldErrors.password || undefined}
          />
          <FieldError>{fieldErrors.password}</FieldError>
        </Field>
        {formError && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in to the studio"}
        </Button>
      </FieldGroup>
    </form>
  );
}
