/**
 * Demo data for the account area (dashboard, orders, wishlist, addresses,
 * notifications).
 *
 * Everything here is mock — there is no backend yet. Product records are pulled
 * from the real catalogue in `lib/site.ts` so order thumbnails, prices and
 * "move to cart" behave exactly like the storefront, and totals are computed
 * with the same `computeTotals` the cart drawer and checkout use.
 *
 * `DEMO_NOW` is a frozen "today": every timestamp below is derived from it, so
 * the copy ("3 days ago", "arriving tomorrow") stays internally consistent and
 * renders identically on the server and in the browser.
 */

import { computeTotals } from "@/lib/cart";
import { CATEGORY_META, PRODUCTS, getProductById } from "@/lib/site";
import { formatShortDate } from "@/lib/utils";
import { buildLineId } from "@/types";
import type {
  Address,
  CartItem,
  CouponState,
  DashboardOrder,
  DashboardUser,
  KidProfile,
  NotificationItem,
  OrderStatus,
  OrderTimelineStep,
  OrderTotals,
  Product,
  ShippingMethod,
} from "@/types";

/** Frozen "now" for the whole account area. */
export const DEMO_NOW = "2026-10-01T09:00:00Z";

/** Anything at or below this is flagged as running low. */
export const LOW_STOCK_THRESHOLD = 15;

/* -------------------------------------------------------------------------- */
/*  Shopper                                                                   */
/* -------------------------------------------------------------------------- */

export const DEMO_KIDS: readonly KidProfile[] = [
  { name: "Emma", birthday: "2021-03-15" },
] as const;

export const DEMO_USER: DashboardUser = {
  name: "Sarah Ahmed",
  email: "sarah@example.com",
  phone: "+880 1712 345678",
  memberSince: "2025-01-10",
  dateOfBirth: "1992-06-18",
  gender: "Female",
  kids: [...DEMO_KIDS],
  rewardPoints: 350,
  totalSpent: 28497, // ৳28,497 in BDT
};

export const MOCK_ADDRESSES: Address[] = [
  {
    id: "addr-home",
    label: "Home",
    fullName: "Sarah Ahmed",
    line1: "House 24, Road 7",
    line2: "Dhanmondi",
    city: "Dhaka",
    state: "Dhaka Division",
    postalCode: "1209",
    country: "Bangladesh",
    phone: "+880 1712 345678",
    isDefault: true,
  },
  {
    id: "addr-office",
    label: "Office",
    fullName: "Sarah Ahmed",
    line1: "Apartment 5B, Green Villa",
    line2: "Gulshan 2",
    city: "Dhaka",
    state: "Dhaka Division",
    postalCode: "1212",
    country: "Bangladesh",
    phone: "+880 1812 998877",
    isDefault: false,
  },
];

/** The demo shopper arrives with a few favourites already saved. */
export const DEMO_WISHLIST_IDS: readonly string[] = [
  "floral-summer-dress",
  "princess-party-gown",
  "rainbow-tutu-skirt",
  "unicorn-backpack",
  "velvet-mary-janes",
] as const;

/** Hand-picked "your little one might love" rail. */
export const RECOMMENDED_IDS: readonly string[] = [
  "denim-dungaree-set",
  "cotton-pajama-set",
  "space-explorer-jacket",
  "butterfly-hair-clips",
] as const;

/* -------------------------------------------------------------------------- */
/*  Status metadata                                                           */
/* -------------------------------------------------------------------------- */

export const ORDER_STATUS_META: Readonly<
  Record<OrderStatus, { label: string; emoji: string; className: string; dot: string }>
> = {
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
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
] as const;

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
/*  Orders                                                                    */
/* -------------------------------------------------------------------------- */

/** Builds a cart line straight from the catalogue so prices never drift. */
function line(
  productId: string,
  color: string,
  size: string,
  quantity: number,
  addedAt: string,
): CartItem {
  const product = getProductById(productId);
  if (!product) throw new Error(`mock-dashboard: unknown product "${productId}"`);

  return {
    lineId: buildLineId(product.id, color, size),
    productId: product.id,
    id: product.id,
    name: product.name,
    price: product.price,
    quantity,
    color,
    size,
    ageRange: product.ageRange,
    imageGradient: CATEGORY_META[product.category].gradient,
    emoji: CATEGORY_META[product.category].emoji,
    stock: product.stock,
    addedAt,
  };
}

interface Timing {
  placedAt: string;
  paidAt: string;
  processingAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  expectedAt?: string;
}

/** Five-step tracker; the furthest reached step pulses while in flight. */
function buildTimeline(
  timing: Timing,
  status: OrderStatus,
  cancelledReason?: string,
): OrderTimelineStep[] {
  const steps: OrderTimelineStep[] = [
    {
      key: "placed",
      label: "Order Placed",
      emoji: "🧾",
      timestamp: timing.placedAt,
      state: "done",
    },
    {
      key: "paid",
      label: "Payment Confirmed",
      emoji: "💳",
      timestamp: timing.paidAt,
      state: "done",
    },
  ];

  if (status === "cancelled") {
    steps.push({
      key: "cancelled",
      label: "Order Cancelled",
      emoji: "❌",
      timestamp: timing.processingAt ?? timing.placedAt,
      note: cancelledReason,
      state: "cancelled",
    });
    return steps;
  }

  if (timing.processingAt) {
    steps.push({
      key: "processing",
      label: "Processing",
      emoji: "📦",
      timestamp: timing.processingAt,
      state: "done",
    });
  }

  if (timing.shippedAt) {
    steps.push({
      key: "shipped",
      label: "Shipped",
      emoji: "🚚",
      timestamp: timing.shippedAt,
      state: "done",
    });
  }

  steps.push(
    status === "delivered" && timing.deliveredAt
      ? {
          key: "delivered",
          label: "Delivered",
          emoji: "🏠",
          timestamp: timing.deliveredAt,
          state: "done",
        }
      : {
          key: "delivered",
          label: "Delivered",
          emoji: "🏠",
          timestamp: "",
          note: timing.expectedAt ? `Expected ${formatShortDate(timing.expectedAt)}` : undefined,
          state: "pending",
        },
  );

  if (status !== "delivered") {
    // The most recent completed step is where the parcel is right now.
    const current = [...steps].reverse().find((step) => step.timestamp);
    if (current) current.state = "current";
  }

  return steps;
}

interface OrderTotalsOptions {
  method?: ShippingMethod;
  giftWrap?: boolean;
  coupon?: CouponState | null;
  /** Cancelled orders refund the shipping fee, so only goods are charged. */
  waiveShipping?: boolean;
}

function totalsFor(items: CartItem[], options: OrderTotalsOptions = {}): OrderTotals {
  const { waiveShipping = false, ...rest } = options;
  const totals = computeTotals(items, rest);

  if (!waiveShipping) {
    return {
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      giftWrap: totals.giftWrap,
      discount: totals.discount,
      total: totals.total,
    };
  }

  return {
    subtotal: totals.subtotal,
    shipping: 0,
    giftWrap: totals.giftWrap,
    discount: totals.discount,
    total: totals.subtotal,
  };
}

const HOME_ADDRESS = MOCK_ADDRESSES[0]!;

interface OrderSeed {
  id: string;
  status: OrderStatus;
  items: CartItem[];
  timing: Timing;
  deliveryNote: string;
  payment: DashboardOrder["payment"];
  carrier?: string;
  trackingNumber?: string;
  cancelledReason?: string;
  totals?: OrderTotalsOptions;
}

function buildOrder(seed: OrderSeed): DashboardOrder {
  return {
    id: seed.id,
    number: `#${seed.id}`,
    placedAt: seed.timing.placedAt,
    status: seed.status,
    items: seed.items,
    totals: totalsFor(seed.items, seed.totals),
    deliveryNote: seed.deliveryNote,
    timeline: buildTimeline(seed.timing, seed.status, seed.cancelledReason),
    shipping: {
      fullName: HOME_ADDRESS.fullName,
      address: HOME_ADDRESS,
      carrier: seed.carrier ?? "DHL Express",
      trackingNumber: seed.trackingNumber ?? "DHL-8842-1190-BD",
    },
    payment: seed.payment,
    cancelledReason: seed.cancelledReason,
  };
}

export const MOCK_ORDERS: readonly DashboardOrder[] = [
  buildOrder({
    id: "LL-2025-00142",
    status: "delivered",
    items: [
      line("floral-summer-dress", "Pink", "4T", 1, "2026-09-24T14:30:00Z"),
      line("light-up-sneakers", "White", "10", 1, "2026-09-24T14:31:00Z"),
    ],
    timing: {
      placedAt: "2026-09-24T14:30:00Z",
      paidAt: "2026-09-24T14:31:00Z",
      processingAt: "2026-09-25T09:00:00Z",
      shippedAt: "2026-09-26T11:00:00Z",
      deliveredAt: "2026-09-28T15:12:00Z",
      expectedAt: "2026-09-28T00:00:00Z",
    },
    deliveryNote: "Delivered 3 days ago",
    payment: { label: "bKash •••• 4521", status: "paid" },
    trackingNumber: "DHL-8842-1190-BD",
  }),
  buildOrder({
    id: "LL-2025-00156",
    status: "shipped",
    items: [
      line("princess-party-gown", "Lavender", "5", 1, "2026-09-29T10:05:00Z"),
      line("butterfly-hair-clips", "Pink", "One Size", 1, "2026-09-29T10:06:00Z"),
    ],
    timing: {
      placedAt: "2026-09-29T10:05:00Z",
      paidAt: "2026-09-29T10:06:00Z",
      processingAt: "2026-09-30T08:45:00Z",
      shippedAt: "2026-10-01T07:20:00Z",
      expectedAt: "2026-10-02T00:00:00Z",
    },
    deliveryNote: "Arriving tomorrow",
    payment: { label: "Visa •••• 8832", status: "paid" },
    trackingNumber: "DHL-9917-4432-BD",
  }),
  buildOrder({
    id: "LL-2025-00163",
    status: "processing",
    items: [line("cozy-bear-hoodie", "Beige", "3T", 2, "2026-09-30T16:12:00Z")],
    timing: {
      placedAt: "2026-09-30T16:12:00Z",
      paidAt: "2026-09-30T16:13:00Z",
      processingAt: "2026-10-01T09:00:00Z",
      expectedAt: "2026-10-06T00:00:00Z",
    },
    deliveryNote: "Estimated 5–7 days",
    payment: { label: "bKash •••• 4521", status: "paid" },
  }),
  buildOrder({
    id: "LL-2025-00098",
    status: "delivered",
    items: [line("dino-graphic-tee", "Navy", "6", 3, "2026-09-11T12:00:00Z")],
    timing: {
      placedAt: "2026-09-11T12:00:00Z",
      paidAt: "2026-09-11T12:01:00Z",
      processingAt: "2026-09-12T09:30:00Z",
      shippedAt: "2026-09-15T10:20:00Z",
      deliveredAt: "2026-09-17T14:05:00Z",
      expectedAt: "2026-09-18T00:00:00Z",
    },
    deliveryNote: "Delivered 2 weeks ago",
    payment: { label: "Visa •••• 8832", status: "paid" },
    trackingNumber: "DHL-7710-2264-BD",
  }),
  buildOrder({
    id: "LL-2025-00087",
    status: "cancelled",
    items: [line("velvet-mary-janes", "Rose", "10", 1, "2026-09-05T11:40:00Z")],
    timing: {
      placedAt: "2026-09-05T11:40:00Z",
      paidAt: "2026-09-05T11:41:00Z",
      processingAt: "2026-09-06T15:05:00Z",
    },
    deliveryNote: "Cancelled by customer",
    payment: { label: "bKash •••• 4521", status: "refunded" },
    cancelledReason: "Cancelled by customer",
    totals: { waiveShipping: true },
  }),
];

export function getOrderById(id: string): DashboardOrder | undefined {
  const wanted = decodeURIComponent(id).replace(/^#/, "");
  return MOCK_ORDERS.find((order) => order.id === wanted);
}

/** Newest first — the order the mock data is written in. */
export function getRecentOrders(limit = 3): DashboardOrder[] {
  return MOCK_ORDERS.slice(0, limit);
}

export function countOrdersByStatus(status: OrderStatus): number {
  return MOCK_ORDERS.filter((order) => order.status === status).length;
}

export function getActiveOrderCount(): number {
  return MOCK_ORDERS.filter(
    (order) => order.status === "processing" || order.status === "shipped",
  ).length;
}

/** True for orders still travelling, which can show a "Track" action. */
export function isTrackable(status: OrderStatus): boolean {
  return status === "processing" || status === "shipped";
}

/** The last delivered order — used by the "Reorder Last Purchase" shortcut. */
export function getLastDeliveredOrder(): DashboardOrder | undefined {
  return MOCK_ORDERS.find((order) => order.status === "delivered");
}

/* -------------------------------------------------------------------------- */
/*  Recommendations                                                           */
/* -------------------------------------------------------------------------- */

export function getRecommendedProducts(limit = 4): Product[] {
  const picked = RECOMMENDED_IDS.map((id) => getProductById(id)).filter(
    (product): product is Product => Boolean(product),
  );

  if (picked.length >= limit) return picked.slice(0, limit);

  const filler = PRODUCTS.filter(
    (product) => product.featured && !picked.some((entry) => entry.id === product.id),
  );

  return [...picked, ...filler].slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/*  Notifications                                                             */
/* -------------------------------------------------------------------------- */

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    emoji: "🚚",
    title: "Your order #LL-2025-00156 has been shipped!",
    body: "DHL Express has your parcel — it should land tomorrow.",
    createdAt: "2026-10-01T07:00:00Z",
    read: false,
    href: "/dashboard/orders/LL-2025-00156",
  },
  {
    id: "notif-2",
    emoji: "🎉",
    title: "Flash Sale! 30% off all dresses this weekend!",
    body: "The party-gown edit and more — until Sunday midnight.",
    createdAt: "2026-09-30T09:00:00Z",
    read: true,
    href: "/shop?category=dresses",
  },
  {
    id: "notif-3",
    emoji: "✅",
    title: "Order #LL-2025-00142 delivered. How was it?",
    body: "A quick review helps other parents pick the right size.",
    createdAt: "2026-09-28T09:00:00Z",
    read: true,
    href: "/dashboard/orders/LL-2025-00142",
  },
  {
    id: "notif-4",
    emoji: "🎂",
    title: "Little Emma's birthday is next month! Gift ideas inside",
    body: "She turns 5 in March — here's what parents gift most.",
    createdAt: "2026-09-26T09:00:00Z",
    read: true,
    href: "/shop?sort=rating",
  },
  {
    id: "notif-5",
    emoji: "💰",
    title: "You earned 50 reward points!",
    body: "That's 350 points ready to spend on the next order.",
    createdAt: "2026-09-24T09:00:00Z",
    read: true,
  },
];
