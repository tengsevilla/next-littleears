import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MOODS } from "@/lib/api/songs";
import type { Mood } from "@/lib/api/types";

export function MoodField({ value, onChange }: { value: Mood; onChange: (mood: Mood) => void }) {
  return (
    <FieldSet>
      <FieldLegend variant="label">Mood</FieldLegend>
      {/* Base UI moves `id` onto its hidden input, so htmlFor never names the role="radio" span: label it directly. */}
      <RadioGroup aria-label="Mood" value={value} onValueChange={(v) => onChange(v as Mood)} className="sm:grid-cols-3">
        {MOODS.map((mood) => (
          <FieldLabel key={mood.value} htmlFor={`mood-${mood.value}`}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{mood.label}</FieldTitle>
                <FieldDescription id={`mood-${mood.value}-description`}>{mood.description}</FieldDescription>
              </FieldContent>
              <RadioGroupItem
                value={mood.value}
                id={`mood-${mood.value}`}
                aria-label={mood.label}
                aria-describedby={`mood-${mood.value}-description`}
              />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
    </FieldSet>
  );
}
