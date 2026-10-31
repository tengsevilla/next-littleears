import { Suspense } from "react";
import type { Metadata } from "next";
import { NewSongPage } from "@/components/pages/new-song";
import { songPrefill } from "@/lib/api/songs";

export const metadata: Metadata = { title: "New song" };

// Rendered only after the studio layout's client auth check (see ../layout.tsx).
export const instant = false;

// searchParams is runtime data, so it is awaited inside Suspense and the shell stays prerenderable.
export default function Page({ searchParams }: PageProps<"/studio/new">) {
  return (
    <Suspense>
      <NewSong searchParams={searchParams} />
    </Suspense>
  );
}

async function NewSong({ searchParams }: Pick<PageProps<"/studio/new">, "searchParams">) {
  return <NewSongPage prefill={songPrefill(await searchParams)} />;
}
