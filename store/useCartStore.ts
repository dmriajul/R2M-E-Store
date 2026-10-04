"use client";

import { create } from "zustand";
import { toast } from "sonner";
import { buildLineId, type CartItem, type Product, type ProductVariant } from "@/types";
import { MAX_QUANTITY_PER_LINE, computeTotals } from "@/lib/cart";
import { CATEGORY_META } from "@/lib/site";

export { MAX_QUANTITY_PER_LINE } from "@/lib/cart";

interface CartState {
  items: CartItem[];
  /** Sum of `price * quantity` across all lines. */
  total: number;
  /** Sum of every line quantity — drives the navbar badge. */
  itemCount: number;

  /**
   * Adds a line, keying it by `${productId}-${color}-${size}` so the same
   * product in two sizes stays as two separate lines.
   *
   * `variantOrColor` accepts either a `{ color, size }` object (legacy call
   * shape used by the product page) or a plain colour string.
   */
  addItem: (
    product: Product,
    quantity?: number,
    variantOrColor?: ProductVariant | string,
    size?: string,
  ) => void;
  removeItem: (lineIdOrProductId: string) => void;
  updateQuantity: (lineIdOrProductId: string, quantity: number) => void;
  clearCart: () => void;

  /* Line editing */
  getItemByLineId: (lineId: string) => CartItem | undefined;
  /** Moving a line to a combination that already exists merges the two. */
  updateItemSize: (lineId: string, size: string) => void;
  updateItemColor: (lineId: string, color: string) => void;
}

const round = (value: number): number => Math.round(value * 100) / 100;

function withTotals(
  items: CartItem[],
): Pick<CartState, "items" | "total" | "itemCount"> {
  return {
    items,
    total: round(items.reduce((sum, item) => sum + item.price * item.quantity, 0)),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

const clampQuantity = (quantity: number, stock: number): number => {
  const ceiling = Math.max(1, Math.min(stock, MAX_QUANTITY_PER_LINE));
  return Math.min(Math.max(1, Math.trunc(quantity)), ceiling);
};

/** Accepts either the new `(lineId, …)` calls or legacy `(productId, …)` calls. */
function resolveLine(items: readonly CartItem[], identifier: string): CartItem | undefined {
  return (
    items.find((item) => item.lineId === identifier) ??
    items.find((item) => item.productId === identifier)
  );
}

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  total: 0,
  itemCount: 0,

  addItem: (product, quantity = 1, variantOrColor, sizeArg) => {
    const variant: ProductVariant =
      typeof variantOrColor === "string"
        ? { color: variantOrColor, size: sizeArg }
        : (variantOrColor ?? {});

    const color = variant.color ?? product.colors[0] ?? "Default";
    const size = variant.size ?? product.sizes[0] ?? "One Size";
    const lineId = buildLineId(product.id, color, size);

    const { items, total: previousTotal } = get();
    const existing = items.find((item) => item.lineId === lineId);

    // Defaults make a product addable straight from a card with no pickers.
    const draft: CartItem = {
      lineId,
      productId: product.id,
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: clampQuantity(quantity, product.stock),
      color,
      size,
      ageRange: product.ageRange,
      imageGradient: CATEGORY_META[product.category].gradient,
      emoji: CATEGORY_META[product.category].emoji,
      stock: product.stock,
      addedAt: new Date().toISOString(),
    };

    const nextItems = existing
      ? items.map((item) =>
          item.lineId === lineId
            ? {
                ...item,
                quantity: clampQuantity(item.quantity + quantity, item.stock),
              }
            : item,
        )
      : [...items, draft];

    set(withTotals(nextItems));

    const nextTotal = get().total;
    toast.success("Added to bag! 🛍️", {
      description: `${product.name} · ${color} · ${size}`,
    });

    // Celebrate crossing the free-shipping line, once.
    if (previousTotal < 50 && nextTotal >= 50) {
      toast.info("Free shipping unlocked! 🚚", {
        description: "Your order ships free — nice one.",
      });
    }
  },

  removeItem: (identifier) => {
    const { items } = get();
    const line = resolveLine(items, identifier);
    if (!line) return;

    set(
      withTotals(
        items.filter((item) => item.lineId !== line.lineId),
      ),
    );

    toast("Removed from bag", { description: `${line.name} · ${line.size}` });
  },

  updateQuantity: (identifier, quantity) => {
    if (quantity <= 0) {
      get().removeItem(identifier);
      return;
    }

    const { items } = get();
    const line = resolveLine(items, identifier);
    if (!line) return;

    set(
      withTotals(
        items.map((item) =>
          item.lineId === line.lineId
            ? { ...item, quantity: clampQuantity(quantity, item.stock) }
            : item,
        ),
      ),
    );
  },

  clearCart: () => set(withTotals([])),

  getItemByLineId: (lineId) =>
    get().items.find((item) => item.lineId === lineId),

  updateItemSize: (lineId, size) => {
    const { items } = get();
    const line = items.find((item) => item.lineId === lineId);
    if (!line || line.size === size) return;

    const nextLineId = buildLineId(line.productId, line.color, size);
    const collision = items.find((item) => item.lineId === nextLineId);

    const nextItems = collision
      ? // Merge into the existing line and drop the one being edited.
        items
          .map((item) =>
            item.lineId === collision.lineId
              ? {
                  ...item,
                  quantity: clampQuantity(item.quantity + line.quantity, item.stock),
                }
              : item,
          )
          .filter((item) => item.lineId !== lineId)
      : items.map((item) =>
          item.lineId === lineId ? { ...item, lineId: nextLineId, size } : item,
        );

    set(withTotals(nextItems));
  },

  updateItemColor: (lineId, color) => {
    const { items } = get();
    const line = items.find((item) => item.lineId === lineId);
    if (!line || line.color === color) return;

    const nextLineId = buildLineId(line.productId, color, line.size);
    const collision = items.find((item) => item.lineId === nextLineId);

    const nextItems = collision
      ? items
          .map((item) =>
            item.lineId === collision.lineId
              ? {
                  ...item,
                  quantity: clampQuantity(item.quantity + line.quantity, item.stock),
                }
              : item,
          )
          .filter((item) => item.lineId !== lineId)
      : items.map((item) =>
          item.lineId === lineId ? { ...item, lineId: nextLineId, color } : item,
        );

    set(withTotals(nextItems));
  },
}));

/* -------------------------------------------------------------------------- */
/*  Selectors — subscribe to the narrowest slice possible.                     */
/* -------------------------------------------------------------------------- */

export const selectCartItems = (state: CartState): CartItem[] => state.items;
export const selectCartTotal = (state: CartState): number => state.total;
export const selectCartItemCount = (state: CartState): number => state.itemCount;
export const selectCartLineCount = (state: CartState): number => state.items.length;
export const selectCartTotals = (state: CartState) => computeTotals(state.items);
export const selectIsInCart = (id: string) => (state: CartState): boolean =>
  state.items.some((item) => item.productId === id || item.lineId === id);

/** Handy inside the drawer and checkout summary. */
export function useCartTotals() {
  const items = useCartStore(selectCartItems);
  return computeTotals(items);
}
