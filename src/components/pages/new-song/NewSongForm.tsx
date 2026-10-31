"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NamePreviewButton } from "@/components/pages/children/NamePreview";
import { ApiClientError } from "@/lib/api/apiClient";
import { AGE_BANDS } from "@/lib/api/children";
import { createSong, isSongListKey, type SongFormValues, songFormSchema } from "@/lib/api/songs";
import type { AgeBand, Child } from "@/lib/api/types";
import { LengthField } from "./LengthField";
import { MoodField } from "./MoodField";

const GENERIC = "generic";
const DEFAULTS: SongFormValues = { childId: null, topic: "", mood: "playful", lengthSec: 60, ageBand: "3-5" };

type Props = {
  prefill: Partial<SongFormValues>;
  childList: Child[] | undefined;
  childrenLoading: boolean;
  onChildMissing: () => void;
};
type FieldErrors = Partial<Record<keyof SongFormValues, string>>;

export function NewSongForm({ prefill, childList, childrenLoading, onChildMissing }: Props) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [values, setValues] = useState<SongFormValues>({ ...DEFAULTS, ...prefill });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Derived, not synced: an unknown/deleted childId simply falls back to a generic song.
  const child = childList?.find((c) => c.id === values.childId) ?? null;
  const ageBand = child?.ageBand ?? values.ageBand;
  const only60 = ageBand === "1-2";
  const lengthSec = only60 ? 60 : values.lengthSec;
  const set = <K extends keyof SongFormValues>(key: K, value: SongFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const childItems = [
    { value: GENERIC, label: "Anyone (generic song)" },
    ...(childList ?? []).map((c) => ({ value: c.id, label: c.displayName })),
  ];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = songFormSchema.safeParse({ ...values, childId: child?.id ?? null, ageBand, lengthSec });
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setErrors({ topic: flat.topic?.[0], lengthSec: flat.lengthSec?.[0], ageBand: flat.ageBand?.[0] });
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const { id } = await createSong(parsed.data);
      void mutate(isSongListKey); // the list picks up the new song in the background
      router.push(`/studio/songs/${id}`);
    } catch (err) {
      setPending(false);
      const code = err instanceof ApiClientError ? err.code : "";
      if (code === "RATE_LIMITED") {
        toast.error("You've made a lot of songs this hour. Please take a break and try again a little later.");
      } else if (code === "NOT_FOUND") {
        setFormError("That child isn't in your studio any more. Please pick again.");
        onChildMissing();
      } else {
        setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="childId">Who is it for?</FieldLabel>
              <Select
                items={childItems}
                value={child?.id ?? GENERIC}
                onValueChange={(v) => set("childId", !v || v === GENERIC ? null : v)}
                disabled={childrenLoading}
              >
                <SelectTrigger id="childId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {childItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {child ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <NamePreviewButton child={child} withLabel />
                  <FieldDescription>We&apos;ll sing {child.displayName}&apos;s name in the song.</FieldDescription>
                </div>
              ) : (
                <>
                  <FieldDescription>A song any child can enjoy, with no name in it.</FieldDescription>
                  <p
                    role="note"
                    className="flex gap-2 rounded-lg bg-sky/20 px-3 py-2 text-sm text-sky-950 dark:bg-sky/15 dark:text-sky-100"
                  >
                    <Users aria-hidden className="mt-0.5 size-4 shrink-0" />
                    Generic songs are shared with all LittleEars families once you approve them. Don&apos;t include
                    names or places.
                  </p>
                </>
              )}
            </Field>

            {!child && (
              <Field data-invalid={!!errors.ageBand || undefined}>
                <FieldLabel htmlFor="ageBand">Age</FieldLabel>
                <Select
                  items={AGE_BANDS}
                  value={values.ageBand}
                  onValueChange={(v) => v && set("ageBand", v as AgeBand)}
                >
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
            )}

            <Field data-invalid={!!errors.topic || undefined}>
              <FieldLabel htmlFor="topic">What should it be about?</FieldLabel>
              <Input
                id="topic"
                autoComplete="off"
                maxLength={120}
                placeholder="e.g. brushing teeth, a red balloon, saying goodnight to the moon"
                value={values.topic}
                onChange={(e) => set("topic", e.target.value)}
                aria-invalid={!!errors.topic || undefined}
              />
              <FieldError>{errors.topic}</FieldError>
            </Field>

            <MoodField value={values.mood} onChange={(mood) => set("mood", mood)} />
            <LengthField
              value={lengthSec}
              onChange={(length) => set("lengthSec", length)}
              only60={only60}
              error={errors.lengthSec}
            />

            {formError && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? "Starting your song…" : child ? `Make ${child.displayName}'s song` : "Make the song"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
