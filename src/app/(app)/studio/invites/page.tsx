import type { Metadata } from "next";
import { InvitesPage } from "@/components/pages/invites";

export const metadata: Metadata = { title: "Invites" };

// Rendered only after the studio layout's client auth check (see ../layout.tsx).
export const instant = false;

export default function Page() {
  return <InvitesPage />;
}
