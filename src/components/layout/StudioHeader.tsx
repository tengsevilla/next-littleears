"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { LogOut, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/studio", label: "Songs" },
  { href: "/studio/new", label: "New song" },
  { href: "/studio/children", label: "Children" },
  { href: "/studio/catalog", label: "Catalog" },
] as const;
// Hidden for parents only as a convenience — the API enforces admin access (403).
const ADMIN_NAV = [{ href: "/studio/invites", label: "Invites" }] as const;

/** A song's detail page belongs to "Songs". */
const isActive = (href: string, pathname: string) =>
  pathname === href || (href === "/studio" && pathname.startsWith("/studio/songs/"));

export function StudioHeader({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [signingOut, setSigningOut] = useState(false);
  const nav = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

  async function handleLogout() {
    setSigningOut(true);
    await logout();
    // Drop every cached response so the next account never sees this one's data.
    await mutate(() => true, undefined, { revalidate: false });
    router.replace("/login");
  }

  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/studio" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Music className="size-4" />
          </span>
          <span>
            Little<span className="text-primary">Ears</span>
            <span className="ml-1.5 text-sm font-semibold text-muted-foreground">Studio</span>
          </span>
        </Link>

        <nav aria-label="Studio" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 sm:order-none sm:w-auto">
          {nav.map(({ href, label }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-sky/30 text-foreground hover:bg-sky/40",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden max-w-48 truncate text-sm text-muted-foreground md:inline">{email}</span>
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={signingOut}>
            <LogOut data-icon="inline-start" />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>
    </header>
  );
}
