import type { Metadata } from "next";
import { PlayPage } from "@/components/pages/play";

export const metadata: Metadata = { title: "Play" };

export default function Page() {
  return <PlayPage />;
}
