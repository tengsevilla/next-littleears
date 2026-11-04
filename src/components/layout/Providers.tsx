"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* Service worker is off in dev so stale precache never masks code changes. No reload on `online`: it
          would stop a kid's song mid-play. Pages recover by themselves (SWR revalidates on reconnect, the
          kid session re-checks, the play queue flushes); only the ~offline fallback page reloads itself. */}
      <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"} reloadOnOnline={false}>
        {children}
        <Toaster />
      </SerwistProvider>
    </ThemeProvider>
  );
}
