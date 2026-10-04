/**
 * Shared domain types for the LUXE storefront.
 * Keep these framework-agnostic — they are consumed by the store, API
 * routes, and future server components alike.
 */

export type CurrencyCode = "USD" | "EUR" | "GBP";

export type ProductCategory =
  | "watches"
  | "fragrance"
  | "leather"
  | "eyewear"
  | "audio"
  | "accessories";

export type ProductStatus = "draft" | "active" | "archived";

export interface Product {
  id: string;
  /** URL-safe identifier used by /product/[id]. */
  slug: string;
  name: string;
  /** Short marketing line shown on cards. */
  tagline: string;
  description: string;
  /** Price in the smallest display unit (e.g. dollars, not cents). */
  price: number;
  /** Original price when the item is discounted. */
  compareAtPrice?: number;
  currency: CurrencyCode;
  images: string[];
  category: ProductCategory;
  tags: string[];
  rating: number;
  reviewCount: number;
  stock: number;
  featured: boolean;
  status: ProductStatus;
  createdAt: string;
}

/** Variables a shopper can pick before adding an item to the cart. */
export interface ProductVariant {
  size?: string;
  color?: string;
  material?: string;
}

export interface CartItem {
  /** Mirrors `product.id` so a product appears once per variant. */
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

/** Uniform envelope for future API route responses. */
export interface ApiResponse<TData> {
  data: TData | null;
  error: string | null;
  success: boolean;
}
