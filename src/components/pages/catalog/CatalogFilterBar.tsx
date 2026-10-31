"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AGE_BANDS } from "@/lib/api/children";
import { MOODS } from "@/lib/api/songs";
import type { AgeBand, Mood } from "@/lib/api/types";

const ANY = "any";
const MOOD_ITEMS = [{ value: ANY, label: "Any mood" }, ...MOODS.map((m) => ({ value: m.value, label: m.label }))];
const AGE_ITEMS = [{ value: ANY, label: "Any age" }, ...AGE_BANDS];

type Props = {
  mood: Mood | null;
  ageBand: AgeBand | null;
  onChange: (next: { mood?: Mood | null; ageBand?: AgeBand | null }) => void;
};

export function CatalogFilterBar({ mood, ageBand, onChange }: Props) {
  return (
    <div role="group" aria-label="Filter the catalog" className="grid grid-cols-2 gap-3 sm:max-w-md">
      <Field>
        <FieldLabel htmlFor="catalog-mood">Mood</FieldLabel>
        <Select
          items={MOOD_ITEMS}
          value={mood ?? ANY}
          onValueChange={(v) => onChange({ mood: !v || v === ANY ? null : (v as Mood) })}
        >
          <SelectTrigger id="catalog-mood" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MOOD_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="catalog-age">Age</FieldLabel>
        <Select
          items={AGE_ITEMS}
          value={ageBand ?? ANY}
          onValueChange={(v) => onChange({ ageBand: !v || v === ANY ? null : (v as AgeBand) })}
        >
          <SelectTrigger id="catalog-age" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGE_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
