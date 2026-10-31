import { Badge } from "@/components/ui/badge";

/** Shows a personalized song's child by displayName (R2: the UI never shows the phonetic spelling). */
export function ChildChip({ name }: { name: string }) {
  return (
    <Badge variant="outline" className="font-semibold">
      For {name}
    </Badge>
  );
}
