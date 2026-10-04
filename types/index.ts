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

export interface CartItem {
  /** Mirrors `product.id` so a product appears once per line. */
  id: string;
  product: Product;
  quantity: number;
  variant?: ProductVariant;
  /** ISO timestamp of when the line was added. */
  addedAt: string;
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
  label: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
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

/** Uniform envelope for future API route responses. */
export interface ApiResponse<TData> {
  data: TData | null;
  error: string | null;
  success: boolean;
}
