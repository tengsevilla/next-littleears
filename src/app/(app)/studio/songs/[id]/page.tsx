import { Suspense } from "react";
import type { Metadata } from "next";
import { SongDetailPage } from "@/components/pages/song";

export const metadata: Metadata = { title: "Song" };

// Rendered only after the studio layout's client auth check (see ../../layout.tsx).
export const instant = false;

// params is a Promise in Next 16; with Cache Components it is awaited inside Suspense so the shell stays prerenderable.
export default function Page({ params }: PageProps<"/studio/songs/[id]">) {
  return (
    <Suspense>
      <SongDetail params={params} />
    </Suspense>
  );
}

async function SongDetail({ params }: Pick<PageProps<"/studio/songs/[id]">, "params">) {
  const { id } = await params;
  return <SongDetailPage id={id} />;
}
