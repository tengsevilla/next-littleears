"use client";

import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AGE_BANDS, type ChildFormValues, childFormSchema, createChild, updateChild } from "@/lib/api/children";
import type { AgeBand, Child } from "@/lib/api/types";
import { NamePreviewButton } from "./NamePreview";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create; a child = edit that child. */
  child: Child | null;
  onSaved: () => void;
};

export function ChildFormDialog({ open, onOpenChange, child, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Popup unmounts on close, and the key resets state when switching child. */}
        <ChildForm key={child?.id ?? "new"} child={child} onDone={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

type FieldErrors = Partial<Record<keyof ChildFormValues, string>>;

function ChildForm({ child, onDone, onSaved }: { child: Child | null; onDone: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<ChildFormValues>({
    displayName: child?.displayName ?? "",
    phoneticName: child?.phoneticName ?? "",
    ageBand: child?.ageBand ?? "3-5", // smart default: the older band covers most kids using the app
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (key: keyof ChildFormValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }));
  const trimmedName = values.displayName.trim();
  // The preview speaks the saved child, so flag unsaved name/pronunciation edits.
  const nameEdited =
    !!child &&
    (trimmedName !== child.displayName || values.phoneticName.trim() !== (child.phoneticName ?? ""));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = childFormSchema.safeParse(values);
    setFormError(null);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setErrors({ displayName: flat.displayName?.[0], phoneticName: flat.phoneticName?.[0], ageBand: flat.ageBand?.[0] });
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const saved = child ? await updateChild(child.id, parsed.data) : await createChild(parsed.data);
      toast.success(child ? `Saved ${saved.displayName}` : `Added ${saved.displayName}`);
      onSaved();
      onDone();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{child ? `Edit ${child.displayName}` : "Add a child"}</DialogTitle>
        <DialogDescription>Their name appears on songs made just for them.</DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <Field data-invalid={!!errors.displayName || undefined}>
          <FieldLabel htmlFor="displayName">Name</FieldLabel>
          <Input
            id="displayName"
            autoComplete="off"
            maxLength={40}
            value={values.displayName}
            onChange={(e) => set("displayName")(e.target.value)}
            aria-invalid={!!errors.displayName || undefined}
          />
          <FieldError>{errors.displayName}</FieldError>
        </Field>

        <Field data-invalid={!!errors.phoneticName || undefined}>
          <FieldLabel htmlFor="phoneticName">
            How to say it <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="phoneticName"
            autoComplete="off"
            maxLength={80}
            value={values.phoneticName}
            onChange={(e) => set("phoneticName")(e.target.value)}
            aria-invalid={!!errors.phoneticName || undefined}
            aria-describedby="phoneticName-help"
          />
          <FieldDescription id="phoneticName-help">How to say it, e.g. &apos;Zoh-ee&apos;</FieldDescription>
          <FieldError>{errors.phoneticName}</FieldError>
        </Field>

        {child ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <NamePreviewButton child={child} withLabel />
            {nameEdited && (
              <p className="text-sm text-muted-foreground">Save your changes to hear the new version.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Save first, then you can hear how it sounds.</p>
        )}

        <Field data-invalid={!!errors.ageBand || undefined}>
          <FieldLabel htmlFor="ageBand">Age</FieldLabel>
          <Select items={AGE_BANDS} value={values.ageBand} onValueChange={(v) => v && set("ageBand")(v as AgeBand)}>
            <SelectTrigger id="ageBand" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGE_BANDS.map((band) => (
                <SelectItem key={band.value} value={band.value}>
                  {band.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{errors.ageBand}</FieldError>
        </Field>

        {formError && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : child ? "Save changes" : trimmedName ? `Add ${trimmedName}` : "Add child"}
        </Button>
      </DialogFooter>
    </form>
  );
}
