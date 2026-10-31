import type { Metadata } from "next";
import { OfflinePage } from "@/components/pages/offline";

export const metadata: Metadata = { title: "Offline" };

export default function Page() {
  return <OfflinePage />;
}
