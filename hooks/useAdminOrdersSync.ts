"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminStore } from "@/store/useAdminStore";
import type { AdminOrder } from "@/types";

/** Two-second polling targets <5s visibility on a healthy connection. No overlap. */
export function useAdminOrdersSync() {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"demo" | "database" | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setRefreshing(true);
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store", signal: controller.signal });
      const result = await response.json() as { data?: AdminOrder[] | null; source?: "demo" | "database"; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not refresh orders");
      if (controller.signal.aborted) return;
      if (result.source === "database" && Array.isArray(result.data)) {
        // Do not reset table pagination/filters on identical poll responses.
        if (JSON.stringify(useAdminStore.getState().orders) !== JSON.stringify(result.data)) {
          useAdminStore.getState().setOrders(result.data);
        }
      }
      setSource(result.source ?? null);
      setError(null);
      setLastUpdated(new Date().toISOString());
    } catch (failure) {
      // Keep the last successfully loaded rows, clearly labelled stale.
      if (inFlight.current === controller) setError(controller.signal.aborted ? "Orders refresh timed out. Displayed orders may be stale." : failure instanceof Error ? failure.message : "Could not refresh orders");
    } finally {
      clearTimeout(timeout);
      if (inFlight.current === controller) { inFlight.current = null; setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => { if (!document.hidden) void refresh(); }, 2000);
    const onFocus = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      const controller = inFlight.current;
      inFlight.current = null;
      controller?.abort();
    };
  }, [refresh]);

  return { refresh, refreshing, error, source, lastUpdated };
}
