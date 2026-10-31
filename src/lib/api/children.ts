import { z } from "zod";
import { apiClient } from "@/lib/api/apiClient";
import type { AgeBand, Child } from "@/lib/api/types";

export const CHILDREN_KEY = "/api/children";

export const AGE_BANDS: { value: AgeBand; label: string }[] = [
  { value: "1-2", label: "1–2 years" },
  { value: "3-5", label: "3–5 years" },
];

// Mirrors the contract's Zod rules: displayName 1–40 letters/combining marks/spaces/hyphens, phoneticName optional 1–80.
export const childFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Please enter a name.")
    .max(40, "Keep it to 40 characters or fewer.")
    .regex(/^[\p{L}\p{M} -]+$/u, "Letters, spaces and hyphens only."),
  phoneticName: z
    .string()
    .trim()
    .max(80, "Keep it to 80 characters or fewer.")
    .transform((v) => (v === "" ? null : v)),
  ageBand: z.enum(["1-2", "3-5"]),
});

export type ChildFormValues = z.input<typeof childFormSchema>;
export type ChildInput = z.output<typeof childFormSchema>;

export async function getChildren(): Promise<Child[]> {
  const { data } = await apiClient<Child[]>(CHILDREN_KEY);
  return data;
}

export async function createChild({ phoneticName, ...rest }: ChildInput): Promise<Child> {
  // POST takes phoneticName as optional — omit it rather than sending null.
  const body = phoneticName ? { ...rest, phoneticName } : rest;
  const { data } = await apiClient<Child>(CHILDREN_KEY, { method: "POST", body: JSON.stringify(body) });
  return data;
}

/** PATCH; phoneticName null clears it. */
export async function updateChild(id: string, input: ChildInput): Promise<Child> {
  const { data } = await apiClient<Child>(`${CHILDREN_KEY}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return data;
}

export async function deleteChild(id: string): Promise<void> {
  await apiClient<null>(`${CHILDREN_KEY}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** POST /:id/name-preview: a spoken clip of phoneticName ?? displayName as a data: URL. Not stored; rate-limited. */
export async function getNamePreview(id: string): Promise<string> {
  const { data } = await apiClient<{ audioUrl: string }>(`${CHILDREN_KEY}/${encodeURIComponent(id)}/name-preview`, {
    method: "POST",
  });
  return data.audioUrl;
}
