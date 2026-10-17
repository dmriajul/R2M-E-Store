"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useCartStore } from "@/store/useCartStore";
import type { ApiResponse, DashboardOrder, Product } from "@/types";

/**
 * Puts a past order back in the bag. The catalogue is re-read from the server
 * (so prices and stock are current), and sold-out lines are skipped — a reorder
 * of a partly unavailable order still adds what it can and says so.
 *
 * No success toast is raised here — `useCartStore.addItem` already announces
 * every line it adds.
 */
export function useReorder() {
  const addItem = useCartStore((state) => state.addItem);

  return useCallback(
    async (order: DashboardOrder) => {
      let catalogue: Product[] = [];
      try {
        const response = await fetch("/api/products", { cache: "no-store" });
        const result = (await response.json()) as ApiResponse<Product[]>;
        if (response.ok && result.success && result.data) catalogue = result.data;
      } catch {
        // Fall through to the "nothing to reorder" message below.
      }

      const byId = new Map(catalogue.map((product) => [product.id, product]));
      const runnable = order.items
        .map((item) => ({ item, product: byId.get(item.productId) }))
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
