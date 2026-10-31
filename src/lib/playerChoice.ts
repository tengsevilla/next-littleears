import { z } from "zod";

// Which child this device plays for. Not a secret and not the session: only a first name the parent picked.
// Storage can throw (private mode, blocked site data) — every access is guarded and callers keep the
// choice in React state, so the player still works for this visit.
const KEY = "littleears.player";

const choiceSchema = z.object({ childId: z.string().nullable(), displayName: z.string() });
export type PlayerChoice = z.infer<typeof choiceSchema>;

export function readPlayerChoice(): PlayerChoice | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = choiceSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function savePlayerChoice(choice: PlayerChoice): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // Not persisted; the in-memory choice still drives this visit.
  }
}

export function clearPlayerChoice(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored to clear.
  }
}
