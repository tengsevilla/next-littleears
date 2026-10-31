import { z } from "zod";
import { ApiClientError, apiClient } from "@/lib/api/apiClient";
import type { CreatedInvite, Invite } from "@/lib/api/types";

export const INVITES_KEY = "/api/invites";

export const inviteFormSchema = z.object({
  email: z.email("Enter the email address of the person you want to invite."),
});

/**
 * POST /api/invites (admin): creates the invite and emails the link (`emailStatus` says whether that worked).
 * Also "Send again": re-inviting an email revokes its older pending invite. 409 if it already has an account.
 */
export async function createInvite(email: string): Promise<CreatedInvite> {
  const { data } = await apiClient<CreatedInvite>(INVITES_KEY, { method: "POST", body: JSON.stringify({ email }) });
  return data;
}

/** Plain-language message for a failed createInvite (form and "Send again"). */
export function inviteErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code === "CONFLICT") return "That email already has a LittleEars account, so there's no need to invite it.";
    if (err.code === "VALIDATION") return "That doesn't look like an email address. Please check it and try again.";
    return err.message;
  }
  return "We couldn't reach LittleEars just now. Check your connection and try again.";
}

/** GET /api/invites (admin), newest first. */
export async function listInvites(): Promise<Invite[]> {
  const { data } = await apiClient<Invite[]>(INVITES_KEY);
  return data;
}

/** DELETE /api/invites/:id (admin): revoke an unused invite. */
export async function revokeInvite(id: string): Promise<void> {
  await apiClient<null>(`${INVITES_KEY}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** GET /api/auth/invites/:token (public): the invited email, or 404 NOT_FOUND for unknown/expired/used. */
export async function getInviteEmail(token: string): Promise<string> {
  const { data } = await apiClient<{ email: string }>(`/api/auth/invites/${encodeURIComponent(token)}`);
  return data.email;
}
