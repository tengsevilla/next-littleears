import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LENGTHS } from "@/lib/api/songs";
import type { LengthSec } from "@/lib/api/types";

const LABEL: Record<LengthSec, string> = { 60: "1 minute", 90: "1½ minutes", 120: "2 minutes" };

type Props = {
  value: LengthSec;
  onChange: (length: LengthSec) => void;
  /** Ages 1–2: only 60 s is allowed. */
  only60: boolean;
  error?: string;
};

export function LengthField({ value, onChange, only60, error }: Props) {
  return (
    <FieldSet data-invalid={!!error || undefined}>
      <FieldLegend variant="label">Length</FieldLegend>
      {/* Base UI moves `id` onto its hidden input, so htmlFor never names the role="radio" span: label it directly. */}
      <RadioGroup
        aria-label="Length"
        value={value}
        onValueChange={(v) => onChange(v as LengthSec)}
        className="grid-cols-3"
        aria-describedby={only60 ? "length-help" : undefined}
      >
        {LENGTHS.map((length) => (
          <Field key={length} orientation="horizontal" data-disabled={(only60 && length !== 60) || undefined}>
            <RadioGroupItem
              value={length}
              id={`length-${length}`}
              aria-label={LABEL[length]}
              disabled={only60 && length !== 60}
            />
            <FieldLabel htmlFor={`length-${length}`} className="font-normal">
              {LABEL[length]}
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>
      {only60 && (
        <FieldDescription id="length-help">
          Songs for ages 1–2 are 1 minute: just right for little attention spans.
        </FieldDescription>
      )}
      <FieldError>{error}</FieldError>
    </FieldSet>
  );
}
