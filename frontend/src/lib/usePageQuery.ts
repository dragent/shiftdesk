"use client";

import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useState } from "react";
import { queryErrorMessage } from "./queryError";

/**
 * Page-level query: fetch via TanStack Query (no setState-in-effect),
 * while keeping a local error slot for mutations on the same screen.
 */
export function usePageQuery<TData>(options: {
  queryKey: QueryKey;
  queryFn: () => Promise<TData>;
  enabled?: boolean;
  fallbackError?: string;
}) {
  const enabled = options.enabled ?? true;
  const query = useQuery({
    queryKey: options.queryKey,
    queryFn: options.queryFn,
    enabled,
  });
  const [actionError, setError] = useState<string | null>(null);
  const error =
    actionError ??
    (query.error
      ? queryErrorMessage(query.error, options.fallbackError ?? "Erreur de chargement.")
      : null);

  return {
    data: query.data,
    loading: enabled && query.isPending,
    error,
    setError,
    refetch: query.refetch,
  };
}
