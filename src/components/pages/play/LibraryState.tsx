import { CloudOff, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Text-free empty/unavailable state: a calm, slowly breathing icon. The parent hint lives behind the gate. */
export function LibraryState({ kind, night }: { kind: "empty" | "unavailable"; night: boolean }) {
  const Icon = kind === "empty" ? Sparkles : CloudOff;
  return (
    <div
      role="img"
      aria-label={kind === "empty" ? "No songs yet" : "Songs are not available right now"}
      className="flex flex-1 items-center justify-center py-12"
    >
      <span
        className={cn(
          "flex size-48 animate-pulse items-center justify-center rounded-full [animation-duration:4s]",
          night ? "bg-amber-200/10 text-amber-200/60" : "bg-sunshine/60 text-stone-900/50",
        )}
      >
        <Icon aria-hidden className="size-24" />
      </span>
    </div>
  );
}
