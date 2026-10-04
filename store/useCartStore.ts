"use client";

import { create } from "zustand";
import type { CartItem, Product, ProductVariant } from "@/types";

export const MAX_QUANTITY_PER_LINE = 10;

interface CartState {
  items: CartItem[];
  /** Sum of `price * quantity` across all lines. */
  total: number;
  /** Sum of every line quantity. */
  itemCount: number;

  addItem: (product: Product, quantity?: number, variant?: ProductVariant) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

/** Recompute the derived cart values. Called after every mutation. */
function withTotals(items: CartItem[]): Pick<CartState, "items" | "total" | "itemCount"> {
  return {
    items,
    total: roundCurrency(
      items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    ),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

const clampQuantity = (quantity: number, stock: number): number => {
  const ceiling = Math.max(1, Math.min(stock, MAX_QUANTITY_PER_LINE));
  return Math.min(Math.max(1, Math.trunc(quantity)), ceiling);
};

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  total: 0,
  itemCount: 0,

  addItem: (product, quantity = 1, variant) => {
    const { items } = get();
    const existing = items.find((item) => item.id === product.id);

    if (existing) {
      const nextQuantity = clampQuantity(
        existing.quantity + quantity,
        product.stock,
      );

      set(
        withTotals(
          items.map((item) =>
            item.id === product.id ? { ...item, quantity: nextQuantity } : item,
          ),
        ),
      );
      return;
    }

    const nextItem: CartItem = {
      id: product.id,
      product,
      quantity: clampQuantity(quantity, product.stock),
      variant,
      addedAt: new Date().toISOString(),
    };

    set(withTotals([...items, nextItem]));
  },

  removeItem: (id) => {
    set(withTotals(get().items.filter((item) => item.id !== id)));
  },

  updateQuantity: (id, quantity) => {
    if (quantity <= 0) {
      get().removeItem(id);
      return;
    }

    set(
      withTotals(
        get().items.map((item) =>
          item.id === id
            ? { ...item, quantity: clampQuantity(quantity, item.product.stock) }
            : item,
        ),
      ),
    );
  },

  clearCart: () => set(withTotals([])),
}));

/* -------------------------------------------------------------------------- */
/* Selectors — subscribe to the narrowest slice possible to avoid re-renders.  */
/* -------------------------------------------------------------------------- */

export const selectCartItems = (state: CartState): CartItem[] => state.items;
export const selectCartTotal = (state: CartState): number => state.total;
export const selectCartItemCount = (state: CartState): number => state.itemCount;
export const selectIsInCart = (id: string) => (state: CartState): boolean =>
  state.items.some((item) => item.id === id);

/**
 * Persistence (localStorage / server sync) is intentionally not wired up yet —
 * layer it on with zustand's `persist` middleware when the backend lands.
 */
