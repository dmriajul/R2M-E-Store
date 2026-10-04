"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/useCartStore";

/**
 * Rehydrates the persisted bag once the app is running in the browser.
 *
 * The cart store uses `skipHydration: true` so the server HTML and the first
 * client render agree (empty bag) — this effect then swaps in whatever
 * `localStorage` held, which keeps the navbar badge stable through hydration.
 */
export function CartHydration() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  return null;
}
