"use client";

import useSWR from "swr";
import { CHILDREN_KEY, getChildren } from "@/lib/api/children";

export function useChildren() {
  const { data, error, isLoading, mutate } = useSWR(CHILDREN_KEY, getChildren);
  return { children: data, error: error as Error | undefined, isLoading, mutate };
}
