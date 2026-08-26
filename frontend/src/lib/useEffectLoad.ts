"use client";

import { useEffect } from "react";

/**
 * Runs an async loader from an effect without a synchronous setState in the
 * effect body (`react-hooks/set-state-in-effect`).
 *
 * Data-fetching loaders typically call `setLoading(true)` immediately; wrapping
 * the call in a microtask keeps that setState off the effect's synchronous path.
 */
export function useEffectLoad(load: () => void | Promise<void>, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load, enabled]);
}
