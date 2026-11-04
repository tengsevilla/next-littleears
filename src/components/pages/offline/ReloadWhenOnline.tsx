"use client";

import { useEffect } from "react";

/**
 * The service worker serves this fallback in place of a page it couldn't fetch. Back online, reload so the page
 * that was asked for loads. Nothing plays here, so the reload interrupts nothing (the app-wide reload is off).
 */
export function ReloadWhenOnline() {
  useEffect(() => {
    const reload = () => window.location.reload();
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, []);
  return null;
}
