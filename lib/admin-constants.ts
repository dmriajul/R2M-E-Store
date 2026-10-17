/**
 * Admin console presentation constants.
 *
 * Pure UI vocabulary only — labels, thresholds, enum orderings and the helpers
 * that derive a label from a real record. **No rows live here.** Every number
 * the console shows comes from Postgres through `lib/data/*`; if the database
 * is empty the tables render their empty states.
 */

import type {
  AdminCoupon,
  AdminOrder,
  AdminOrderStatus,
  AdminProduct,
  AdminSettings,
  OrderTimelineStep,
  Product,
  ProductBadge,
  StockState,
} from "@/types";

/** Default threshold: stock at or below this (but above zero) reads as low. */
export const ADMIN_LOW_STOCK_THRESHOLD = 20;

/** Rows per page for every admin table. */
export const ADMIN_PAGE_SIZE = 10;

/* -------------------------------------------------------------------------- */
/*  Products                                                                  */
/* -------------------------------------------------------------------------- */

/** Stock state for a product, using the console-wide threshold. */
export function getStockState(
  stock: number,
  threshold = ADMIN_LOW_STOCK_THRESHOLD,
): StockState {
  if (stock <= 0) return "out-of-stock";
  if (stock <= threshold) return "low-stock";
  return "in-stock";
}

export const STOCK_STATE_LABEL: Readonly<Record<StockState, string>> = {
  "in-stock": "In Stock",
  "low-stock": "Low Stock",
  "out-of-stock": "Out of Stock",
};

/** Products the ops team should restock — lowest stock first. */
export function getLowStockProducts(products: readonly AdminProduct[]): AdminProduct[] {
  return products
    .filter(
      (product) =>
        product.status === "active" &&
        getStockState(product.stock, product.lowStockThreshold) === "low-stock",
    )
    .sort((a, b) => a.stock - b.stock);
}

/** Live product count for one category label. */
export function countProductsInCategory(products: readonly Product[], category: string): number {
  return products.filter((product) => product.category === category).length;
}

/* -------------------------------------------------------------------------- */
/*  Orders                                                                    */
/* -------------------------------------------------------------------------- */

const HOUR = 3_600_000;
const shiftHours = (iso: string, hours: number): string =>
  new Date(new Date(iso).getTime() + hours * HOUR).toISOString();

const STATUS_RANK: Readonly<Record<AdminOrderStatus, number>> = {
  pending: 1,
  confirmed: 2,
  processing: 3,
  shipped: 4,
  delivered: 5,
  cancelled: 0,
  refunded: 0,
};

/** Same five-step shape the storefront tracker uses, rebuilt on status change. */
export function buildAdminTimeline(order: AdminOrder): OrderTimelineStep[] {
  const { placedAt, status, notes } = order;
  const rank = STATUS_RANK[status];

  if (status === "cancelled" || status === "refunded") {
    return [
      step("placed", "Order Placed", "🧾", placedAt, "done"),
      step("paid", "Payment Confirmed", "💳", shiftHours(placedAt, 0.25), "done"),
      step(
        status,
        status === "cancelled" ? "Order Cancelled" : "Refunded",
        status === "cancelled" ? "❌" : "💸",
        shiftHours(placedAt, 26),
        status === "cancelled" ? "cancelled" : "done",
        notes[0],
      ),
    ];
  }

  const steps = [
    step("placed", "Order Placed", "🧾", placedAt, "done"),
    step("paid", "Payment Confirmed", "💳", shiftHours(placedAt, 0.25), "done"),
    step("confirmed", "Confirmed", "✅", shiftHours(placedAt, 1), "done"),
    step("processing", "Processing", "📦", shiftHours(placedAt, 6), "done"),
    step("shipped", "Shipped", "🚚", shiftHours(placedAt, 28), "done"),
    step("delivered", "Delivered", "🏠", shiftHours(placedAt, 54), "done"),
  ];

  steps.forEach((entry, index) => {
    const position = index + 1;
    if (position > rank) {
      entry.state = "pending";
      entry.timestamp = "";
      entry.note = undefined;
    } else if (position === rank && status !== "delivered") {
      entry.state = "current";
    }
  });

  return steps;
}

function step(
  key: string,
  label: string,
  emoji: string,
  timestamp: string,
  state: "done" | "current" | "pending" | "cancelled",
  note?: string,
) {
  return { key, label, emoji, timestamp, state, note };
}

export const ADMIN_STATUSES: readonly AdminOrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export const ADMIN_ORDER_STATUS_LABEL: Readonly<Record<AdminOrderStatus, string>> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** CSV download for the orders table export. */
export function ordersToCsv(orders: readonly AdminOrder[]): string {
  const header = "Order,Customer,Email,Items,Total,Payment,Status,Placed";
  const rows = orders.map((order) =>
    [
      order.id,
      order.customer.name,
      order.customer.email,
      order.items.reduce((sum, item) => sum + item.quantity, 0),
      order.totals.total.toLocaleString("en-BD"),
      order.paymentMethod,
      order.status,
      order.placedAt.slice(0, 10),
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

/* -------------------------------------------------------------------------- */
/*  Coupons                                                                   */
/* -------------------------------------------------------------------------- */

export const COUPON_TYPE_LABEL: Readonly<Record<AdminCoupon["type"], string>> = {
  percentage: "Percentage",
  fixed: "Fixed Amount",
  "free-shipping": "Free Shipping",
};

/** Value column text, e.g. "10% off" / "৳250 off" / "Free shipping". */
export function describeCouponValue(coupon: AdminCoupon): string {
  if (coupon.type === "percentage") return `${coupon.value}% off`;
  if (coupon.type === "fixed") return `৳${coupon.value.toLocaleString("en-BD")} off`;
  return "Free shipping";
}

/** Expiry/limit rules decide whether a coupon is live. */
export function getCouponStatus(
  coupon: AdminCoupon,
  todayIso: string = new Date().toISOString(),
) {
  const today = todayIso.slice(0, 10);
  if (coupon.usageLimit > 0 && coupon.uses >= coupon.usageLimit) return "depleted" as const;
  if (coupon.endsAt < today) return "expired" as const;
  if (!coupon.active) return "expired" as const;
  if (coupon.startsAt > today) return "scheduled" as const;
  return "active" as const;
}

/* -------------------------------------------------------------------------- */
/*  Form option lists                                                         */
/* -------------------------------------------------------------------------- */

/** Emoji choices offered by the category dialog. */
export const CATEGORY_EMOJI_CHOICES = [
  "👗",
  "👕",
  "👖",
  "👟",
  "🧥",
  "🎀",
  "🧸",
  "🦄",
  "🚀",
  "🌸",
] as const;

export const PRODUCT_BADGE_CHOICES: readonly (ProductBadge | "none")[] = [
  "none",
  "New",
  "Sale",
  "Bestseller",
  "Organic",
] as const;

export const ADMIN_CURRENCIES = ["BDT", "USD", "EUR"] as const;
export const ADMIN_TIMEZONES = ["Asia/Dhaka", "Asia/Kolkata", "Europe/London", "America/New_York"] as const;

/* -------------------------------------------------------------------------- */
/*  Settings                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Blank starting point for the settings forms.
 *
 * These sections are **not persisted yet** (only the homepage hero is — see
 * `lib/data/hero-settings.ts`), so the forms open empty rather than pre-filled
 * with somebody else's merchant ids and API keys.
 */
export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  general: {
    storeName: "",
    storeEmail: "",
    phone: "",
    address: "",
    currency: "BDT",
    timezone: "Asia/Dhaka",
  },
  shipping: {
    freeShippingThreshold: 5000,
    standardRate: 80,
    expressRate: 150,
    giftWrapPrice: 50,
  },
  payments: {
    stripeKey: "",
    stripeEnabled: false,
    bkashMerchantId: "",
    bkashEnabled: false,
    sslcommerzStoreId: "",
    sslcommerzEnabled: false,
  },
  notifications: {
    orderConfirmation: true,
    shippingUpdate: true,
    lowStockAlert: true,
    adminEmail: "",
  },
};
