import { z } from "zod";
import { apiClient } from "@/lib/api/apiClient";
import type { AgeBand, CreatedSong, LengthSec, Mood, RegenPart, Song, SongStatus, SongSummary } from "@/lib/api/types";

export const SONGS_KEY = "/api/songs";
export const POLL_MS = 3000;

export const songKey = (id: string) => `${SONGS_KEY}/${encodeURIComponent(id)}`;
export const songsKey = (status?: SongStatus) => (status ? `${SONGS_KEY}?status=${status}` : SONGS_KEY);
/** Matches every song-list key (all + per-status), for revalidating after a create/mutation/delete. */
export const isSongListKey = (key: unknown) =>
  key === SONGS_KEY || (typeof key === "string" && key.startsWith(`${SONGS_KEY}?`));

const IN_PROGRESS: ReadonlySet<SongStatus> = new Set(["queued", "writing", "checking", "composing", "illustrating", "mixing"]);
/** queued…mixing: the worker still owns the song, so the UI polls. */
export const isInProgress = (status: SongStatus) => IN_PROGRESS.has(status);

export const MOODS: { value: Mood; label: string; description: string }[] = [
  { value: "playful", label: "Playful", description: "Bouncy and bright, for dancing and giggles." },
  { value: "calm", label: "Calm", description: "Gentle and easy, for quiet play and car rides." },
  { value: "lullaby", label: "Lullaby", description: "Soft and slow, for winding down to sleep." },
];
export const LENGTHS: LengthSec[] = [60, 90, 120];
export const PART_LABEL: Record<RegenPart, string> = { lyrics: "lyrics", music: "music", image: "picture" };
/** Contract: songs for ages 1–2 are 60 s only. */
export const maxLengthFor = (ageBand: AgeBand): LengthSec => (ageBand === "1-2" ? 60 : 120);

// Mirrors the contract's POST /api/songs rules. `ageBand` is the effective band — the child's when one is
// picked, else the parent's choice — so the 1–2 → 60 s rule can be checked here; it is sent only for generic songs.
export const songFormSchema = z
  .object({
    childId: z.string().nullable(),
    topic: z
      .string()
      .trim()
      .min(2, "Tell us a little more: at least 2 characters.")
      .max(120, "Keep it to 120 characters or fewer."),
    mood: z.enum(["playful", "calm", "lullaby"]),
    lengthSec: z.literal([60, 90, 120]),
    ageBand: z.enum(["1-2", "3-5"]),
  })
  .refine((v) => v.lengthSec <= maxLengthFor(v.ageBand), {
    path: ["lengthSec"],
    message: "Songs for ages 1–2 are 60 seconds.",
  });

export type SongFormValues = z.input<typeof songFormSchema>;
export type SongInput = z.output<typeof songFormSchema>;

export async function createSong({ childId, ageBand, ...rest }: SongInput): Promise<CreatedSong> {
  // ageBand is required iff there is no child; for a child the API takes the child's band.
  const body = childId ? { ...rest, childId } : { ...rest, ageBand };
  const { data } = await apiClient<CreatedSong>(SONGS_KEY, { method: "POST", body: JSON.stringify(body) });
  return data;
}

export async function listSongs(status?: SongStatus): Promise<SongSummary[]> {
  const { data } = await apiClient<SongSummary[]>(songsKey(status));
  return data;
}

export async function getSong(id: string): Promise<Song> {
  const { data } = await apiClient<Song>(songKey(id));
  return data;
}

export async function approveSong(id: string): Promise<Song> {
  const { data } = await apiClient<Song>(`${songKey(id)}/approve`, { method: "POST" });
  return data;
}

export async function rejectSong(id: string): Promise<Song> {
  const { data } = await apiClient<Song>(`${songKey(id)}/reject`, { method: "POST" });
  return data;
}

export async function regenerateSong(id: string, part: RegenPart): Promise<Song> {
  const { data } = await apiClient<Song>(`${songKey(id)}/regenerate`, {
    method: "POST",
    body: JSON.stringify({ part }),
  });
  return data;
}

export async function deleteSong(id: string): Promise<void> {
  await apiClient<null>(songKey(id), { method: "DELETE" });
}

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Initial form values from /studio/new?topic=…&mood=…&lengthSec=…&childId=…&ageBand=… ("Try again"). Invalid values are ignored. */
export function songPrefill(params: SearchParams): Partial<SongFormValues> {
  const mood = MOODS.find((m) => m.value === one(params.mood))?.value;
  const lengthSec = LENGTHS.find((l) => String(l) === one(params.lengthSec));
  const ageBand = one(params.ageBand);
  const topic = one(params.topic)?.slice(0, 120);
  const childId = one(params.childId);
  return {
    ...(topic && { topic }),
    ...(mood && { mood }),
    ...(lengthSec && { lengthSec }),
    ...((ageBand === "1-2" || ageBand === "3-5") && { ageBand }),
    ...(childId && { childId }),
  };
}

/** The inverse of songPrefill, for a rejected or failed song. */
export function tryAgainHref(song: Pick<Song, "topic" | "mood" | "lengthSec" | "childId" | "ageBand">): string {
  const params = new URLSearchParams({ topic: song.topic, mood: song.mood, lengthSec: String(song.lengthSec) });
  if (song.childId) params.set("childId", song.childId);
  else params.set("ageBand", song.ageBand);
  return `/studio/new?${params}`;
}
