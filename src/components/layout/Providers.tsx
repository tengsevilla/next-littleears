"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* Service worker is off in dev so stale precache never masks code changes. */}
      <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"}>
        {children}
        <Toaster />
      </SerwistProvider>
    </ThemeProvider>
  );
}
