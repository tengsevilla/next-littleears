import Link from "next/link";
import { Music, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 bg-[oklch(0.97_0.03_85)] px-6 py-16 dark:bg-background">
      <header className="flex flex-col items-center gap-3 text-center">
        <span aria-hidden className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <Music className="size-10" />
        </span>
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
          Little<span className="text-primary">Ears</span>
        </h1>
        <p className="max-w-sm text-lg text-muted-foreground">
          Little songs, made for little ears — and approved by grown-ups.
        </p>
      </header>

      <nav className="grid w-full max-w-2xl gap-5 sm:grid-cols-2">
        <Tile href="/play" className="bg-sunshine text-stone-900" icon={<Play className="size-14 fill-current" />}>
          Let&apos;s play!
        </Tile>
        <Tile href="/studio" className="bg-sky text-stone-900" icon={<Music className="size-14" />}>
          Grown-ups: make a song
        </Tile>
      </nav>
    </main>
  );
}

function Tile({
  href,
  icon,
  className,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-44 flex-col items-center justify-center gap-3 rounded-3xl p-6 text-center text-2xl font-bold shadow-md transition-transform outline-none hover:-translate-y-1 hover:shadow-lg focus-visible:ring-4 focus-visible:ring-ring/60 active:translate-y-0",
        className,
      )}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </Link>
  );
}
