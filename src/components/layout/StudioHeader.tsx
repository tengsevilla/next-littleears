"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { LogOut, Music, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  /** Shown below sm (five links share a 375 px row) and at md–lg (the links share the top row with logo and Sign out). */
  short?: string;
};

const NAV: NavItem[] = [
  { href: "/studio", label: "Songs" },
  { href: "/studio/children", label: "Children" },
  { href: "/studio/catalog", label: "Catalog" },
];
// Hidden for parents only as a convenience — the API enforces admin access (403).
const ADMIN_NAV: NavItem[] = [
  { href: "/studio/invites", label: "Invites" },
  { href: "/studio/dashboard", label: "Dashboard", short: "Stats" },
];

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
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 md:flex-nowrap lg:gap-x-6">
        <Link href="/studio" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Music className="size-4" />
          </span>
          <span>
            Little<span className="text-primary">Ears</span>
            <span className="ml-1.5 text-sm font-semibold text-muted-foreground">Studio</span>
          </span>
        </Link>

        {/* Below md the links get their own row; overflow-x-auto is only a fallback for very narrow screens.
            From md up everything shares one row, so the nav never shrinks — the email gives way instead. */}
        <nav aria-label="Studio" className="scrollbar-none order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 md:order-none md:w-auto md:shrink-0">
          {nav.map(({ href, label, short }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1.5 text-sm sm:px-3 md:px-2.5 lg:px-3 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-sky/30 text-foreground hover:bg-sky/40",
                )}
              >
                {short ? (
                  <>
                    <span className="sm:hidden md:inline lg:hidden">{short}</span>
                    <span className="hidden sm:inline md:hidden lg:inline">{label}</span>
                  </>
                ) : (
                  label
                )}
              </Link>
            );
          })}
          <PlayLink className="ml-1 hidden md:inline-flex" />
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2 md:gap-3">
          {/* Only from xl, and it truncates first; below that the email is the Sign out button's tooltip. */}
          <span className="hidden min-w-0 max-w-48 truncate text-sm text-muted-foreground xl:inline">{email}</span>
          {/* Below md, Play sits in the top row so the links row never has to scroll. */}
          <PlayLink className="inline-flex md:hidden" />
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            title={`Signed in as ${email}`}
            onClick={handleLogout}
            disabled={signingOut}
          >
            <LogOut data-icon="inline-start" />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>
    </header>
  );
}

/**
 * Hand the device to the kid. Rendered twice (top row on phones, end of the nav on desktop) with responsive
 * classes, so exactly one is visible. It leaves the studio, so it is never the current page.
 */
function PlayLink({ className }: { className: string }) {
  return (
    <Link
      href="/play"
      className={cn(
        "shrink-0 items-center gap-1.5 rounded-full bg-sunshine px-3.5 py-1.5 text-sm font-bold text-stone-900 shadow-sm transition-colors outline-none hover:bg-sunshine/85 focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <Play aria-hidden className="size-4 fill-current" />
      Play
    </Link>
  );
}
