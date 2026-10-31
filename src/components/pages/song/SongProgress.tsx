import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { SongStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type StepState = "done" | "current" | "todo";

const STEPS: { status: SongStatus; label: string }[] = [
  { status: "writing", label: "Writing the words" },
  { status: "checking", label: "Safety check" },
  { status: "composing", label: "Composing the music" },
  { status: "illustrating", label: "Drawing the cover" },
  { status: "mixing", label: "Mixing it all together" },
];

/** Live pipeline steps while the song is queued…mixing. Step one ("got your idea") is already done. */
export function SongProgress({ status }: { status: SongStatus }) {
  const current = STEPS.findIndex((s) => s.status === status); // -1 while queued
  const steps: { label: string; state: StepState }[] = [
    { label: "Got your idea", state: "done" },
    ...STEPS.map((s, i) => ({ label: s.label, state: i < current ? "done" : i === current ? "current" : "todo" }) as const),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Making your song</CardTitle>
        <CardDescription>
          {current === -1 ? "In the queue, starting in a moment." : "This page updates by itself, no need to refresh."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol aria-label="Song progress" className="flex flex-col gap-2.5">
          {steps.map((step) => (
            <li
              key={step.label}
              aria-current={step.state === "current" ? "step" : undefined}
              className={cn(
                "flex items-center gap-3 text-sm",
                step.state === "todo" && "text-muted-foreground",
                step.state === "current" && "font-bold",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  step.state === "done" && "border-transparent bg-meadow/50 text-emerald-950",
                  step.state === "current" && "border-transparent bg-sky/40 text-sky-950",
                )}
              >
                {step.state === "done" ? (
                  <Check className="size-3.5" />
                ) : step.state === "current" ? (
                  <Spinner aria-label={undefined} role={undefined} className="size-3.5" />
                ) : null}
              </span>
              {step.label}
              {step.state === "done" && <span className="sr-only">(done)</span>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
