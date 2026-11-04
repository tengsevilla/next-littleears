"use client";

import { useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api/apiClient";
import { getCurrentUser, redirectToLogin, refreshToken } from "@/lib/auth";

export type KidSession = "checking" | "online" | "offline";

/**
 * The kid device rides on the parent's refresh cookie. A 401 sends the parent to /login (and back to /play);
 * any other failure — no network, API down — keeps the player running from the service worker's cache.
 * Started offline, it checks again in the background when the device comes back online, without unmounting
 * the player (nothing that is playing stops).
 */
export function useKidSession(): KidSession {
  const [session, setSession] = useState<KidSession>(() => (getCurrentUser() ? "online" : "checking"));

  useEffect(() => {
    if (session !== "checking") return;
    let cancelled = false;
    refreshToken().then(
      () => {
        if (!cancelled) setSession("online");
      },
      (err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 401) redirectToLogin();
        else setSession("offline");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (session !== "offline") return;
    let cancelled = false;
    const onOnline = () => {
      refreshToken().then(
        () => {
          if (!cancelled) setSession("online");
        },
        (err: unknown) => {
          if (!cancelled && err instanceof ApiClientError && err.status === 401) redirectToLogin();
        },
      );
    };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [session]);

  return session;
}
