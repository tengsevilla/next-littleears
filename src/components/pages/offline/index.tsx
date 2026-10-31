import Link from "next/link";
import { CloudOff } from "lucide-react";

export function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <CloudOff aria-hidden className="size-16 text-primary" />
      <h1 className="text-3xl font-extrabold tracking-tight">No internet right now</h1>
      <p className="max-w-sm text-muted-foreground">This page needs a connection. Your songs will be back soon.</p>
      <Link href="/play" className="rounded-full bg-primary px-8 py-4 text-lg font-bold text-primary-foreground">
        Go to the player
      </Link>
    </main>
  );
}
