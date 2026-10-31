import type { Metadata } from "next";
import { StudioPage } from "@/components/pages/studio";

export const metadata: Metadata = { title: "Studio" };

// Rendered only after the studio layout's client auth check (see layout.tsx).
export const instant = false;

export default function Page() {
  return <StudioPage />;
}
