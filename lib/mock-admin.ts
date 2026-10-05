/**
 * Demo data for the admin console.
 *
 * Nothing here touches a database — every CRUD action in the console mutates
 * the client store seeded from this file. Products come from the real
 * catalogue (`lib/site.ts`) and the five shopper-facing orders are the same
 * records the account area shows, so the two sides of the app never disagree.
 */

import { computeTotals } from "@/lib/cart";
import { CATEGORY_META, PRODUCTS, getProductById } from "@/lib/site";
import { MOCK_ORDERS, DEMO_NOW } from "@/lib/mock-dashboard";
import { slugify } from "@/lib/utils";
import { isManualPayment, paymentMethodFromLabel } from "@/lib/payments";
import { buildLineId } from "@/types";
import type {
  Address,
  OrderTimelineStep,
  AdminCategory,
  AdminCoupon,
  AdminCustomer,
  AdminKpi,
  AdminNotification,
  AdminOrder,
  AdminOrderStatus,
  AdminProduct,
  AdminSettings,
  Bestseller,
  BreakdownRow,
  CartItem,
  Product,
  ProductBadge,
  ProductCategory,
  PaymentStatusKey,
  RevenuePoint,
  StockState,
} from "@/types";

/** Signed-in operator (decorative — there is no auth backend). */
export const ADMIN_USER = {
  name: "Riajul Khandokar",
  email: "admin@littleluxe.com",
  role: "Admin",
  initials: "RK",
} as const;

/** Default threshold: stock at or below this (but above zero) reads as low. */
export const ADMIN_LOW_STOCK_THRESHOLD = 20;

/** Rows per page for every admin table. */
export const ADMIN_PAGE_SIZE = 10;

/* -------------------------------------------------------------------------- */
/*  Dashboard KPIs + revenue                                                  */
/* -------------------------------------------------------------------------- */

export const ADMIN_KPIS: readonly AdminKpi[] = [
  {
    id: "revenue",
    emoji: "💰",
    label: "Today's Revenue",
    value: "৳1,24,750", // BDT
    trend: 12.5,
    trendUnit: "percent",
    spark: [9, 12, 8, 14, 11, 16, 19],
  },
  {
    id: "orders",
    emoji: "📦",
    label: "Orders Today",
    value: "18",
    trend: 3,
    trendUnit: "count",
    spark: [6, 9, 7, 11, 10, 14, 18],
  },
  {
    id: "customers",
    emoji: "👥",
    label: "New Customers",
    value: "7",
    trend: -2,
    trendUnit: "count",
    spark: [5, 8, 9, 6, 7, 9, 7],
  },
  {
    id: "sold",
    emoji: "🧸",
    label: "Products Sold",
    value: "34",
    trend: 8,
    trendUnit: "count",
    spark: [12, 18, 15, 22, 19, 26, 34],
  },
] as const;

/** Mon–Sun. Sums to ৳84,320 → avg ৳12,046/day, matching BDT pricing. */
export const REVENUE_7D: readonly RevenuePoint[] = [
  { label: "Mon", value: 10205 },
  { label: "Tue", value: 11808 },
  { label: "Wed", value: 9803 },
  { label: "Thu", value: 13400 },
  { label: "Fri", value: 14625 },
  { label: "Sat", value: 12480 },
  { label: "Sun", value: 12000 },
] as const;

/** Thirty-day series; labelled every fifth day when charted. */
export const REVENUE_30D: readonly RevenuePoint[] = [
  { label: "Sep 2", value: 8600 },
  { label: "Sep 3", value: 9400 },
  { label: "Sep 4", value: 10150 },
  { label: "Sep 5", value: 7800 },
  { label: "Sep 6", value: 12900 },
  { label: "Sep 7", value: 14200 },
  { label: "Sep 8", value: 11050 },
  { label: "Sep 9", value: 9950 },
  { label: "Sep 10", value: 11800 },
  { label: "Sep 11", value: 13450 },
  { label: "Sep 12", value: 15600 },
  { label: "Sep 13", value: 12100 },
  { label: "Sep 14", value: 10400 },
  { label: "Sep 15", value: 8900 },
  { label: "Sep 16", value: 11200 },
  { label: "Sep 17", value: 13800 },
  { label: "Sep 18", value: 14750 },
  { label: "Sep 19", value: 12650 },
  { label: "Sep 20", value: 13300 },
  { label: "Sep 21", value: 9700 },
  { label: "Sep 22", value: 10850 },
  { label: "Sep 23", value: 12150 },
  { label: "Sep 24", value: 14050 },
  { label: "Sep 25", value: 15200 },
  { label: "Sep 26", value: 13100 },
  { label: "Sep 27", value: 11800 },
  { label: "Sep 28", value: 10900 },
  { label: "Sep 29", value: 12450 },
  { label: "Sep 30", value: 13900 },
  { label: "Oct 1", value: 12475 },
] as const;

export interface RevenueSummary {
  total: number;
  average: number;
}

export function summariseRevenue(points: readonly RevenuePoint[]): RevenueSummary {
  const total = points.reduce((sum, point) => sum + point.value, 0);
  return {
    total: Math.round(total * 100) / 100,
    average: points.length === 0 ? 0 : Math.round((total / points.length) * 100) / 100,
  };
}

/** Units sold this week — revenue is derived from the catalogue price. */
const BESTSELLER_UNITS: readonly { productId: string; unitsSold: number }[] = [
  { productId: "princess-party-gown", unitsSold: 24 },
  { productId: "light-up-sneakers", unitsSold: 19 },
  { productId: "floral-summer-dress", unitsSold: 16 },
  { productId: "dino-graphic-tee", unitsSold: 14 },
  { productId: "cozy-bear-hoodie", unitsSold: 12 },
] as const;

export const ADMIN_BESTSELLERS: readonly Bestseller[] = BESTSELLER_UNITS.map(
  ({ productId, unitsSold }) => {
    const product = getProductById(productId);
    return {
      productId,
      name: product?.name ?? productId,
      unitsSold,
      revenue: Math.round((product?.price ?? 0) * unitsSold),
    };
  },
);

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

function makeSku(product: Product, index: number): string {
  const stem = product.id.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase();
  return `LL-${stem}-${String(index + 1).padStart(3, "0")}`;
}

/** Catalogue → console records. Extra ops fields get sensible defaults. */
export function buildAdminProducts(): AdminProduct[] {
  return PRODUCTS.map((product, index) => ({
    ...product,
    sku: makeSku(product, index),
    costPerItem: Math.round(product.price * 0.45),
    lowStockThreshold: ADMIN_LOW_STOCK_THRESHOLD,
    trackInventory: true,
    metaTitle: `${product.name} | Little Luxe`,
    metaDescription: product.tagline,
  }));
}

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

/* -------------------------------------------------------------------------- */
/*  Orders                                                                    */
/* -------------------------------------------------------------------------- */

interface Person {
  name: string;
  email: string;
  phone: string;
}

const PEOPLE: Readonly<Record<string, Person>> = {
  sarah: { name: "Sarah Ahmed", email: "sarah@example.com", phone: "+880 1712 345678" },
  priya: { name: "Priya Khan", email: "priya.khan@example.com", phone: "+880 1812 445566" },
  james: { name: "James Wilson", email: "james.wilson@example.com", phone: "+44 7700 900123" },
  fatima: { name: "Fatima Rahman", email: "fatima.rahman@example.com", phone: "+880 1913 778899" },
  ayesha: { name: "Ayesha Siddiqua", email: "ayesha.s@example.com", phone: "+880 1711 223344" },
  tanvir: { name: "Tanvir Hasan", email: "tanvir.hasan@example.com", phone: "+880 1611 556677" },
  nusrat: { name: "Nusrat Jahan", email: "nusrat.jahan@example.com", phone: "+880 1515 998877" },
  michael: { name: "Michael Chen", email: "michael.chen@example.com", phone: "+1 415 555 0132" },
} as const;

export const ADMIN_CUSTOMER_IDS = Object.keys(PEOPLE);

/** Builds a cart line straight from the catalogue so prices never drift. */
function orderLine(
  productId: string,
  color: string,
  size: string,
  quantity: number,
  addedAt: string,
): CartItem {
  const product = getProductById(productId);
  if (!product) throw new Error(`mock-admin: unknown product "${productId}"`);

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

const HOUR = 3_600_000;
const shiftHours = (iso: string, hours: number): string =>
  new Date(new Date(iso).getTime() + hours * HOUR).toISOString();

const STATUS_RANK: Readonly<Record<AdminOrderStatus, number>> = {
  pending: 1,
  processing: 2,
  shipped: 3,
  delivered: 4,
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

interface AdminOrderSeed {
  id: string;
  person: Person;
  status: AdminOrderStatus;
  placedAt: string;
  items: CartItem[];
  paymentMethod: string;
  notes?: string[];
  address?: Address;
  /** Manual-payment state; derived from the method + status when omitted. */
  paymentStatus?: PaymentStatusKey;
  /** Payment screenshot / transaction reference (demo receipt for seeded rows). */
  paymentRef?: string;
}

/**
 * Demo payment screenshots shipped in `public/uploads/payments/`.
 *
 * They look like wallet receipts so the console's "Verify Payment" flow can be
 * exercised without a wallet account — Cloudinary holds the real ones.
 */
const DEMO_PAYMENT_SCREENSHOTS: Readonly<Record<string, string>> = {
  "LL-2025-00171": "/demo/payments/demo-bkash-receipt.svg",
  "LL-2025-00172": "/demo/payments/demo-rocket-receipt.svg",
};

/** Cash stays unpaid until delivery; wallets wait for verification while pending. */
function derivePaymentStatus(seed: AdminOrderSeed): PaymentStatusKey {
  if (seed.status === "refunded") return "REFUNDED";
  if (seed.status === "cancelled") return "FAILED";

  const method = paymentMethodFromLabel(seed.paymentMethod);

  if (method === "COD") return seed.status === "delivered" ? "PAID" : "UNPAID";
  if (method === null || !isManualPayment(method)) return "PAID";

  return seed.status === "pending" ? "PENDING" : "PAID";
}

const HOME_ADDRESS: Address = {
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
};

function addressFor(person: Person, index: number): Address {
  if (person.email === PEOPLE.sarah?.email) return HOME_ADDRESS;

  return {
    id: `addr-${slugify(person.name)}`,
    label: index % 2 === 0 ? "Home" : "Office",
    fullName: person.name,
    line1: index % 2 === 0 ? "12 Rose Avenue" : "Suite 400, Marina Tower",
    line2: index % 2 === 0 ? "Gulshan 1" : "Banani",
    city: index % 3 === 0 ? "Chattogram" : "Dhaka",
    state: "Dhaka Division",
    postalCode: index % 2 === 0 ? "1212" : "1213",
    country: person.phone.startsWith("+44")
      ? "United Kingdom"
      : person.phone.startsWith("+1")
        ? "United States"
        : "Bangladesh",
    phone: person.phone,
    isDefault: true,
  };
}

function buildAdminOrder(seed: AdminOrderSeed, index: number): AdminOrder {
  const totals = computeTotals(seed.items);

  const order: AdminOrder = {
    id: seed.id,
    number: `#${seed.id}`,
    customer: seed.person,
    items: seed.items,
    totals: {
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      giftWrap: totals.giftWrap,
      discount: totals.discount,
      total: totals.total,
    },
    status: seed.status,
    paymentMethod: seed.paymentMethod,
    paymentStatus: seed.paymentStatus ?? derivePaymentStatus(seed),
    paymentRef: seed.paymentRef ?? DEMO_PAYMENT_SCREENSHOTS[seed.id],
    placedAt: seed.placedAt,
    shipping: addressFor(seed.person, index),
    notes: seed.notes ?? [],
    timeline: [],
  };

  order.timeline = buildAdminTimeline(order);
  return order;
}

const shopperOrders: AdminOrderSeed[] = MOCK_ORDERS.map((order) => ({
  id: order.id,
  person: PEOPLE.sarah!,
  status: order.status,
  placedAt: order.placedAt,
  items: order.items,
  paymentMethod: order.payment.label,
  notes: order.cancelledReason ? [order.cancelledReason] : [],
}));

const extraOrders: AdminOrderSeed[] = [
  {
    id: "LL-2025-00171",
    person: PEOPLE.priya!,
    status: "pending",
    placedAt: "2026-10-01T06:10:00Z",
    paymentMethod: "bKash •••• 7712",
    items: [
      orderLine("rainbow-tutu-skirt", "Pink", "4T", 1, "2026-10-01T06:10:00Z"),
      orderLine("unicorn-backpack", "Lavender", "One Size", 1, "2026-10-01T06:11:00Z"),
    ],
  },
  {
    id: "LL-2025-00172",
    person: PEOPLE.fatima!,
    status: "pending",
    placedAt: "2026-10-02T09:41:00Z",
    paymentMethod: "Rocket •••• 5120",
    items: [
      orderLine("floral-summer-dress", "Rose", "4T", 1, "2026-10-02T09:41:00Z"),
      orderLine("butterfly-hair-clips", "Rose", "One Size", 2, "2026-10-02T09:42:00Z"),
    ],
  },
  {
    id: "LL-2025-00170",
    person: PEOPLE.james!,
    status: "pending",
    placedAt: "2026-09-30T18:40:00Z",
    paymentMethod: "Visa •••• 2210",
    items: [orderLine("space-explorer-jacket", "Navy", "6", 1, "2026-09-30T18:40:00Z")],
  },
  {
    id: "LL-2025-00168",
    person: PEOPLE.fatima!,
    status: "processing",
    placedAt: "2026-09-30T11:05:00Z",
    paymentMethod: "Cash on Delivery",
    items: [orderLine("cotton-pajama-set", "Sky", "3T", 2, "2026-09-30T11:05:00Z")],
    notes: ["Customer asked for gift wrapping — added by hand."],
  },
  {
    id: "LL-2025-00165",
    person: PEOPLE.ayesha!,
    status: "shipped",
    placedAt: "2026-09-29T14:20:00Z",
    paymentMethod: "Stripe •••• 6641",
    items: [orderLine("princess-party-gown", "Rose", "6", 1, "2026-09-29T14:20:00Z")],
  },
  {
    id: "LL-2025-00160",
    person: PEOPLE.priya!,
    status: "delivered",
    placedAt: "2026-09-20T09:15:00Z",
    paymentMethod: "bKash •••• 7712",
    items: [orderLine("dino-graphic-tee", "Mint", "5", 2, "2026-09-20T09:15:00Z")],
  },
  {
    id: "LL-2025-00158",
    person: PEOPLE.tanvir!,
    status: "refunded",
    placedAt: "2026-09-18T16:30:00Z",
    paymentMethod: "Visa •••• 8890",
    items: [orderLine("light-up-sneakers", "Blue", "12", 1, "2026-09-18T16:30:00Z")],
    notes: ["Refunded in full — the lights stopped working after a week."],
  },
  {
    id: "LL-2025-00150",
    person: PEOPLE.fatima!,
    status: "delivered",
    placedAt: "2026-09-12T08:00:00Z",
    paymentMethod: "Nagad •••• 3390",
    items: [orderLine("butterfly-hair-clips", "Rose", "One Size", 1, "2026-09-12T08:00:00Z")],
  },
];

export const ADMIN_ORDERS: readonly AdminOrder[] = [...shopperOrders, ...extraOrders]
  .map((seed, index) => buildAdminOrder(seed, index))
  .sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1));

export function getAdminOrderById(id: string): AdminOrder | undefined {
  const wanted = decodeURIComponent(id).replace(/^#/, "");
  return ADMIN_ORDERS.find((order) => order.id === wanted);
}

/** All-time counters for the orders stat strip. */
export const ORDER_STATS = {
  total: 156,
  pending: 8,
  shipped: 12,
  delivered: 130,
  cancelled: 6,
} as const;

/* -------------------------------------------------------------------------- */
/*  Customers                                                                 */
/* -------------------------------------------------------------------------- */

interface CustomerSeed {
  key: string;
  joinedAt: string;
  active: boolean;
}

const CUSTOMER_SEEDS: readonly CustomerSeed[] = [
  { key: "sarah", joinedAt: "2025-01-10", active: true },
  { key: "priya", joinedAt: "2025-02-04", active: true },
  { key: "james", joinedAt: "2025-02-18", active: true },
  { key: "fatima", joinedAt: "2024-11-22", active: true },
  { key: "ayesha", joinedAt: "2025-03-02", active: true },
  { key: "tanvir", joinedAt: "2025-01-28", active: false },
  { key: "nusrat", joinedAt: "2024-12-15", active: false },
  { key: "michael", joinedAt: "2025-03-10", active: true },
] as const;

/** Order count and lifetime spend, derived from the orders above. */
export function buildAdminCustomers(orders: readonly AdminOrder[]): AdminCustomer[] {
  return CUSTOMER_SEEDS.map((seed, index) => {
    const person = PEOPLE[seed.key];
    if (!person) throw new Error(`mock-admin: unknown customer "${seed.key}"`);

    const mine = orders.filter((order) => order.customer.email === person.email);
    const totalSpent = mine.reduce(
      (sum, order) => sum + (order.status === "cancelled" ? 0 : order.totals.total),
      0,
    );

    return {
      id: `cust-${seed.key}`,
      name: person.name,
      email: person.email,
      phone: person.phone,
      joinedAt: seed.joinedAt,
      active: seed.active,
      orderCount: mine.length,
      totalSpent: Math.round(totalSpent),
      addresses: [addressFor(person, index)],
    };
  });
}

export const ADMIN_CUSTOMERS: readonly AdminCustomer[] = buildAdminCustomers(ADMIN_ORDERS);

/* -------------------------------------------------------------------------- */
/*  Coupons                                                                   */
/* -------------------------------------------------------------------------- */

export const ADMIN_COUPONS: readonly AdminCoupon[] = [
  {
    id: "coupon-welcome10",
    code: "WELCOME10",
    type: "percentage",
    value: 10,
    minOrder: 5000,
    uses: 45,
    usageLimit: 100,
    startsAt: "2026-01-01",
    endsAt: "2026-12-31",
    categories: [],
    active: true,
  },
  {
    id: "coupon-summer25",
    code: "SUMMER25",
    type: "fixed",
    value: 250,
    minOrder: 10000,
    uses: 12,
    usageLimit: 50,
    startsAt: "2026-06-01",
    endsAt: "2026-11-30",
    categories: ["Dresses", "Bottoms"],
    active: true,
  },
  {
    id: "coupon-freeship",
    code: "FREESHIP",
    type: "free-shipping",
    value: 0,
    minOrder: 0,
    uses: 89,
    usageLimit: 0,
    startsAt: "2026-02-01",
    endsAt: "2026-12-31",
    categories: [],
    active: true,
  },
  {
    id: "coupon-birthday",
    code: "BIRTHDAY",
    type: "percentage",
    value: 20,
    minOrder: 3000,
    uses: 5,
    usageLimit: 20,
    startsAt: "2026-06-01",
    endsAt: "2026-08-15",
    categories: [],
    active: false,
  },
] as const;

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
export function getCouponStatus(coupon: AdminCoupon, todayIso: string = DEMO_NOW) {
  const today = todayIso.slice(0, 10);
  if (coupon.usageLimit > 0 && coupon.uses >= coupon.usageLimit) return "depleted" as const;
  if (coupon.endsAt < today) return "expired" as const;
  if (!coupon.active) return "expired" as const;
  if (coupon.startsAt > today) return "scheduled" as const;
  return "active" as const;
}

/* -------------------------------------------------------------------------- */
/*  Categories                                                                */
/* -------------------------------------------------------------------------- */

/** One-line descriptions shown on the category cards. */
const CATEGORY_BLURB: Readonly<Record<ProductCategory, string>> = {
  Dresses: "Party frocks, summer dresses and matching sets.",
  "Tops & Tees": "Everyday tees, shirts and cosy layering pieces.",
  Bottoms: "Skirts, dungarees and playground-proof trousers.",
  Shoes: "First walkers, sneakers and party shoes.",
  Outerwear: "Jackets and hoodies for colder adventures.",
  Accessories: "Bags, clips and finishing touches.",
};

export const ADMIN_CATEGORIES: readonly AdminCategory[] = (
  Object.keys(CATEGORY_META) as ProductCategory[]
).map((name) => ({
  id: `cat-${CATEGORY_META[name].slug}`,
  name,
  slug: CATEGORY_META[name].slug,
  emoji: CATEGORY_META[name].emoji,
  description: CATEGORY_BLURB[name],
  parent: null,
}));

/** Live product counts per category, straight from the catalogue. */
export function countProductsInCategory(products: readonly Product[], category: string): number {
  return products.filter((product) => product.category === category).length;
}

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

/* -------------------------------------------------------------------------- */
/*  Analytics                                                                 */
/* -------------------------------------------------------------------------- */

export const ORDERS_BY_CATEGORY: readonly BreakdownRow[] = [
  { label: "Dresses", value: 35, hint: "Best performing line" },
  { label: "Tops & Tees", value: 25 },
  { label: "Shoes", value: 18 },
  { label: "Bottoms", value: 12 },
  { label: "Outerwear", value: 6 },
  { label: "Accessories", value: 4 },
] as const;

export const TRAFFIC_SOURCES: readonly BreakdownRow[] = [
  { label: "Direct", value: 40, hint: "Bookmarks + app" },
  { label: "Instagram", value: 25, hint: "Paid + organic" },
  { label: "Google", value: 20, hint: "Search + shopping" },
  { label: "Facebook", value: 15 },
] as const;

export const CONVERSION_RATE = {
  value: 3.2,
  trend: 0.4,
  /** Sessions → orders, shown beside the headline number. */
  sessions: 4875,
  orders: 156,
} as const;

export const ADMIN_NOTIFICATIONS: readonly AdminNotification[] = [
  {
    id: "admin-notif-1",
    emoji: "🛒",
    title: "New order #LL-2025-00171 — ৳5,299",
    createdAt: "2026-10-01T06:12:00Z",
    href: "/admin/orders",
    read: false,
  },
  {
    id: "admin-notif-2",
    emoji: "⚠️",
    title: "Velvet Mary Janes is out of stock",
    createdAt: "2026-10-01T05:00:00Z",
    href: "/admin/products",
    read: false,
  },
  {
    id: "admin-notif-3",
    emoji: "💸",
    title: "Refund requested on #LL-2025-00158",
    createdAt: "2026-09-30T16:40:00Z",
    href: "/admin/orders",
    read: false,
  },
  {
    id: "admin-notif-4",
    emoji: "🎉",
    title: "Bestseller milestone: 24 gowns this week",
    createdAt: "2026-09-29T09:00:00Z",
    href: "/admin/analytics",
    read: true,
  },
] as const;

/* -------------------------------------------------------------------------- */
/*  Settings                                                                  */
/* -------------------------------------------------------------------------- */

export const ADMIN_SETTINGS: AdminSettings = {
  general: {
    storeName: "Little Luxe",
    storeEmail: "hello@littleluxe.com",
    phone: "+880 1712 345678",
    address: "House 24, Road 7, Dhanmondi, Dhaka 1209, Bangladesh",
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
    stripeKey: "sk_live_51N8x•••••••••••••4f2a",
    stripeEnabled: true,
    bkashMerchantId: "BK-MERCHANT-77120",
    bkashEnabled: true,
    sslcommerzStoreId: "lxstore062026",
    sslcommerzEnabled: false,
  },
  notifications: {
    orderConfirmation: true,
    shippingUpdate: true,
    lowStockAlert: true,
    adminEmail: "ops@littleluxe.com",
  },
};

export const ADMIN_CURRENCIES = ["BDT", "USD", "EUR"] as const;
export const ADMIN_TIMEZONES = ["Asia/Dhaka", "Asia/Kolkata", "Europe/London", "America/New_York"] as const;
export const ADMIN_STATUSES: readonly AdminOrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export const ADMIN_ORDER_STATUS_LABEL: Readonly<Record<AdminOrderStatus, string>> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** CSV preview for the mock export action. */
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
