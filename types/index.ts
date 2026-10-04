/**
 * Shared domain types for the LITTLE LUXE storefront (kids fashion, ages 0–14).
 * Keep these framework-agnostic — they are consumed by the store, API routes,
 * server components and the 3D viewer alike.
 */

export type CurrencyCode = "USD" | "EUR" | "GBP";

/** Merchandising categories. */
export type ProductCategory =
  | "Dresses"
  | "Tops & Tees"
  | "Bottoms"
  | "Shoes"
  | "Outerwear"
  | "Accessories";

export type ProductGender = "Girls" | "Boys" | "Unisex";

export type ProductBadge = "New" | "Sale" | "Bestseller" | "Organic";

/** Age buckets used by the shop filters. */
export type AgeFilter = "All Ages" | "0-2Y" | "3-5Y" | "6-8Y" | "9-14Y";

export type ProductStatus = "draft" | "active" | "archived";

export interface Product {
  id: string;
  /** URL-safe identifier — also used to derive placeholder image tokens. */
  slug: string;
  name: string;
  /** Short marketing line shown on cards and in search. */
  tagline: string;
  description: string;
  /** Current price in dollars (not cents). */
  price: number;
  /** Was-price, present only while an item is discounted. */
  originalPrice?: number;
  /**
   * @deprecated Back-compat alias of `originalPrice`, kept so the Step 2
   * featured card keeps rendering sale prices without changes.
   */
  compareAtPrice?: number;
  currency: CurrencyCode;
  /**
   * Placeholder image tokens (e.g. `floral-summer-dress-1`). There are no
   * external images in this build — the UI paints gradients + emoji from
   * `CATEGORY_META` instead.
   */
  images: string[];

  /* ---- Kids-specific attributes ---- */
  category: ProductCategory;
  /** Display label, e.g. "3-6Y". Source of truth for age filtering. */
  ageRange: string;
  gender: ProductGender;
  /** Colour names; hex values live in `COLOR_HEX`. */
  colors: string[];
  sizes: string[];
  material: string;
  badge?: ProductBadge;
  /** Hex colour driving the 3D viewer material. */
  modelColor: string;

  /* ---- Merchandising ---- */
  tags: string[];
  rating: number;
  reviewCount: number;
  /** Units on hand. `inStock` is derived from this at module load. */
  stock: number;
  inStock: boolean;
  featured: boolean;
  status: ProductStatus;
  createdAt: string;
}

/** Optional choices captured when an item is added to the cart. */
export interface ProductVariant {
  size?: string;
  color?: string;
}

/** How a cart line is keyed: same product in two sizes = two lines. */
export function buildLineId(
  productId: string,
  color: string,
  size: string,
): string {
  return `${productId}-${color}-${size}`;
}

/**
 * One line in the shopping bag. Flat and display-ready: the bag and the
 * checkout summary render straight from these fields, so a line survives
 * without the full `Product` record.
 */
export interface CartItem {
  /** Composite key: `${productId}-${color}-${size}`. */
  lineId: string;
  productId: string;
  /**
   * @deprecated Alias of `productId`, kept so earlier card components that
   * assert `item.id === product.id` keep working. Use `lineId` for updates.
   */
  id: string;
  name: string;
  price: number;
  quantity: number;
  color: string;
  size: string;
  ageRange: string;
  /** Tailwind gradient stops for the thumbnail, e.g. "from-pink-400 to-rose-600". */
  imageGradient: string;
  /** Category emoji painted over the thumbnail. */
  emoji: string;
  /** Units on hand when the line was created — used to clamp the quantity. */
  stock: number;
  /** ISO timestamp of when the line was added. */
  addedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Checkout                                                                  */
/* -------------------------------------------------------------------------- */

export type ShippingMethod = "standard" | "express";

export type PaymentMethod = "card" | "mobile" | "sslcommerz";

export interface CouponState {
  code: string;
  /** Percentage off the subtotal. */
  percent: number;
}

/** Order summary produced when an order is placed (mock — no processing). */
export interface PlacedOrder {
  number: string;
  email: string;
  placedAt: string;
  /** ISO date. */
  estimatedDelivery: string;
  items: CartItem[];
  totals: {
    subtotal: number;
    shipping: number;
    giftWrap: number;
    discount: number;
    total: number;
  };
}

/* -------------------------------------------------------------------------- */
/*  Auth                                                                      */
/* -------------------------------------------------------------------------- */

export interface AuthSession {
  name: string;
  email: string;
  phone?: string;
}

export type UserRole = "customer" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
}

export interface Address {
  id: string;
  /** Short handle shown on the card, e.g. "Home" or "Office". */
  label: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  currency: CurrencyCode;
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
}

/** Parent review shown on the product page. */
export interface Review {
  id: string;
  author: string;
  location: string;
  rating: number;
  title: string;
  body: string;
  /** Human-friendly relative date, e.g. "2 weeks ago". */
  date: string;
  verified: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Dashboard (account area)                                                  */
/* -------------------------------------------------------------------------- */

/** Statuses shown on the order list, the filter tabs and the badge colours. */
export type OrderStatus = "processing" | "shipped" | "delivered" | "cancelled";

/** How one row of the tracking timeline should read. */
export type OrderStepState = "done" | "current" | "pending" | "cancelled";

export interface OrderTimelineStep {
  key: string;
  label: string;
  emoji: string;
  /** ISO instant, or an empty string while the step is still pending. */
  timestamp: string;
  /** Free-text rider, e.g. "Expected Oct 2". */
  note?: string;
  state: OrderStepState;
}

/** Money breakdown for a placed order. */
export interface OrderTotals {
  subtotal: number;
  shipping: number;
  giftWrap: number;
  discount: number;
  total: number;
}

/** One order in the demo account area (a real backend replaces this). */
export interface DashboardOrder {
  /** Without the leading "#", e.g. "LL-2025-00142". */
  id: string;
  /** Display form including the "#". */
  number: string;
  placedAt: string;
  status: OrderStatus;
  items: CartItem[];
  totals: OrderTotals;
  /** Human line under the header, e.g. "Arriving tomorrow". */
  deliveryNote: string;
  timeline: OrderTimelineStep[];
  shipping: {
    fullName: string;
    address: Address;
    carrier: string;
    trackingNumber: string;
  };
  payment: {
    label: string;
    status: "paid" | "pending" | "refunded";
  };
  /** Present only on cancelled orders. */
  cancelledReason?: string;
}

export interface NotificationItem {
  id: string;
  emoji: string;
  title: string;
  body?: string;
  createdAt: string;
  read: boolean;
  /** Optional deep link the notification points at. */
  href?: string;
}

export interface KidProfile {
  name: string;
  /** ISO date. */
  birthday: string;
}

/** The signed-in shopper (mock — auth is decorative in this build). */
export interface DashboardUser {
  name: string;
  email: string;
  phone: string;
  /** ISO date. */
  memberSince: string;
  dateOfBirth: string;
  gender: string;
  kids: KidProfile[];
  rewardPoints: number;
  totalSpent: number;
}

export type DashboardPreferenceKey =
  | "emailNotifications"
  | "smsNotifications"
  | "marketingEmails"
  | "birthdayReminders";

export type DashboardPreferences = Record<DashboardPreferenceKey, boolean>;

/** Uniform envelope for future API route responses. */
export interface ApiResponse<TData> {
  data: TData | null;
  error: string | null;
  success: boolean;
}
