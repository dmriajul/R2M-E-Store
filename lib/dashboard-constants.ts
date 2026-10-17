/**
 * Account-area presentation constants.
 *
 * Labels, status styling and the stock helper only. **No shopper data lives
 * here** — orders, addresses, notifications and the wishlist are read from the
 * signed-in account (Postgres) and render empty until it has any.
 */

import type { DashboardUser, OrderStatus } from "@/types";

/** Anything at or below this is flagged as running low on the wishlist tiles. */
export const LOW_STOCK_THRESHOLD = 15;

/* -------------------------------------------------------------------------- */
/*  Status metadata                                                           */
/* -------------------------------------------------------------------------- */

export const ORDER_STATUS_META: Readonly<
  Record<OrderStatus, { label: string; emoji: string; className: string; dot: string }>
> = {
  pending: { label: "Pending", emoji: "⏳", className: "border-amber-400/30 bg-amber-400/12 text-amber-300", dot: "bg-amber-400" },
  confirmed: { label: "Confirmed", emoji: "✅", className: "border-sky-400/30 bg-sky-400/12 text-sky-300", dot: "bg-sky-400" },
  refunded: { label: "Refunded", emoji: "↩️", className: "border-rose/35 bg-rose-soft text-rose", dot: "bg-rose" },
  processing: {
    label: "Processing",
    emoji: "⏳",
    className: "border-amber-400/30 bg-amber-400/12 text-amber-300",
    dot: "bg-amber-400",
  },
  shipped: {
    label: "Shipped",
    emoji: "🚚",
    className: "border-sky-400/30 bg-sky-400/12 text-sky-300",
    dot: "bg-sky-400",
  },
  delivered: {
    label: "Delivered",
    emoji: "✅",
    className: "border-emerald-400/30 bg-emerald-400/12 text-emerald-300",
    dot: "bg-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    emoji: "❌",
    className: "border-rose/35 bg-rose-soft text-rose",
    dot: "bg-rose",
  },
};

export const ORDER_FILTERS: readonly { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
] as const;

/** True for orders still travelling, which can show a "Track" action. */
export function isTrackable(status: OrderStatus): boolean {
  return ["pending", "confirmed", "processing", "shipped"].includes(status);
}

/* -------------------------------------------------------------------------- */
/*  Stock                                                                     */
/* -------------------------------------------------------------------------- */

export type StockStatusKey = "in-stock" | "low-stock" | "out-of-stock";

export interface StockStatus {
  key: StockStatusKey;
  label: string;
  className: string;
}

/** Colour-coded stock label used on the wishlist tiles. */
export function getStockStatus(stock: number): StockStatus {
  if (stock <= 0) {
    return {
      key: "out-of-stock",
      label: "Out of Stock",
      className: "border-rose/35 bg-rose-soft text-rose",
    };
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return {
      key: "low-stock",
      label: "Low Stock",
      className: "border-amber-400/30 bg-amber-400/12 text-amber-300",
    };
  }
  return {
    key: "in-stock",
    label: "In Stock",
    className: "border-emerald-400/30 bg-emerald-400/12 text-emerald-300",
  };
}

/* -------------------------------------------------------------------------- */
/*  Profile                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * What the profile looks like before the session is applied — no name, no
 * email, nothing that could be mistaken for a signed-in person. The
 * account-area layout replaces it with the real session user before anything
 * renders.
 */
export const EMPTY_DASHBOARD_PROFILE: DashboardUser = {
  name: "",
  email: "",
  phone: "",
  memberSince: "",
  dateOfBirth: "",
  gender: "",
  kids: [],
  rewardPoints: 0,
  totalSpent: 0,
};
