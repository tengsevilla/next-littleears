"use client";

import { useEffect, useState } from "react";
import { Music } from "lucide-react";
import type { User } from "@/lib/api/types";
import { getCurrentUser, redirectToLogin, refreshToken } from "@/lib/auth";
import { StudioHeader } from "./StudioHeader";
import { StudioUserProvider } from "./StudioUser";

type AuthState = { status: "checking" } | { status: "ready"; user: User };

export function StudioShell({ children }: { children: React.ReactNode }) {
  // Coming straight from /login the session is already in memory; on a hard load it is not.
  const [auth, setAuth] = useState<AuthState>(() => {
    const user = getCurrentUser();
    return user ? { status: "ready", user } : { status: "checking" };
  });

  useEffect(() => {
    if (auth.status === "ready") return;
    let cancelled = false;
    refreshToken().then(
      ({ user }) => {
        if (!cancelled) setAuth({ status: "ready", user });
      },
      () => {
        if (!cancelled) redirectToLogin();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [auth.status]);

  if (auth.status === "checking") return <StudioLoading />;

  return (
    <StudioUserProvider value={auth.user}>
      <div className="flex flex-1 flex-col bg-[oklch(0.985_0.012_85)] dark:bg-background">
        <StudioHeader email={auth.user.email} isAdmin={auth.user.role === "admin"} />
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </div>
    </StudioUserProvider>
  );
}

function StudioLoading() {
  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <span aria-hidden className="flex size-12 animate-pulse items-center justify-center rounded-full bg-primary/15 text-primary">
        <Music className="size-6" />
      </span>
      <p className="text-sm">Getting your studio ready…</p>
    </div>
  );
}
