"use client";

import { createContext, use } from "react";
import type { User } from "@/lib/api/types";

const StudioUserContext = createContext<User | null>(null);

export const StudioUserProvider = StudioUserContext.Provider;

/** The signed-in user. Studio pages render only after StudioShell has restored the session. */
export function useStudioUser(): User {
  const user = use(StudioUserContext);
  if (!user) throw new Error("useStudioUser must be used inside StudioShell");
  return user;
}
