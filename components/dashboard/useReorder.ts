"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { getProductById } from "@/lib/site";
import { useCartStore } from "@/store/useCartStore";
import type { DashboardOrder } from "@/types";

/**
 * Puts a past order back in the bag. Sold-out lines are skipped, so a reorder
 * of a partly unavailable order still adds what it can and says so.
 *
 * No success toast is raised here — `useCartStore.addItem` already announces
 * every line it adds.
 */
export function useReorder() {
  const addItem = useCartStore((state) => state.addItem);

  return useCallback(
    (order: DashboardOrder) => {
      const runnable = order.items
        .map((item) => ({ item, product: getProductById(item.productId) }))
        .filter((entry) => Boolean(entry.product?.inStock));

      runnable.forEach(({ item, product }) => {
        if (product) addItem(product, item.quantity, item.color, item.size);
      });

      if (runnable.length === 0) {
        toast.error("Nothing to reorder", {
          description: "Every piece on this order is out of stock right now.",
        });
        return;
      }

      if (runnable.length < order.items.length) {
        toast.info("Some pieces sold out", {
          description: "The rest are back in your bag 🛍️",
        });
      }
    },
    [addItem],
  );
}
