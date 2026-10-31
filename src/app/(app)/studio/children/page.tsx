import type { Metadata } from "next";
import { ChildrenPage } from "@/components/pages/children";

export const metadata: Metadata = { title: "Children" };

// Rendered only after the studio layout's client auth check (see ../layout.tsx).
export const instant = false;

export default function Page() {
  return <ChildrenPage />;
}
