import type { Metadata } from "next";
import { DashboardPage } from "@/components/pages/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

// Rendered only after the studio layout's client auth check (see ../layout.tsx).
export const instant = false;

export default function Page() {
  return <DashboardPage />;
}
