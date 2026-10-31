"use client";

import useSWR from "swr";
import { type CatalogFilters, catalogKey, getCatalog } from "@/lib/api/catalog";

/** One page of the shared catalog; the previous page stays on screen while the next one loads. */
export function useCatalog(filters: CatalogFilters) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(catalogKey(filters), getCatalog, {
    keepPreviousData: true,
  });
  return { catalog: data, error: error as Error | undefined, isLoading, isValidating, mutate };
}
