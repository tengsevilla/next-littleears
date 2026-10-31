import type { Metadata } from "next";
import { CatalogPage } from "@/components/pages/catalog";

export const metadata: Metadata = { title: "Catalog" };

// Rendered only after the studio layout's client auth check (see ../layout.tsx).
export const instant = false;

export default function Page() {
  return <CatalogPage />;
}
