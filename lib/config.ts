/**
 * Central runtime configuration.
 *
 * Everything here reads from the environment but never throws when a value is
 * missing — each getter falls back to the demo value the storefront already
 * uses, so `npm run dev` works on a bare checkout.
 */

import { isCloudinaryConfigured, isDatabaseConfigured, isSSLCommerzEnabled } from "@/lib/demo-mode";
import type { ProductCategory } from "@/types";

/* -------------------------------------------------------------------------- */
/*  Currency                                                                  */
/* -------------------------------------------------------------------------- */

export type CurrencyCode = "USD" | "EUR" | "GBP" | "BDT";

const SYMBOLS: Readonly<Record<CurrencyCode, string>> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  BDT: "৳",
};

/** Default is BDT for Bangladesh market. */
export const STORE_CURRENCY: CurrencyCode = ((): CurrencyCode => {
  const raw = (process.env.NEXT_PUBLIC_CURRENCY ?? "BDT").toUpperCase();
  return raw in SYMBOLS ? (raw as CurrencyCode) : "BDT";
})();

export function currencySymbol(code: CurrencyCode = STORE_CURRENCY): string {
  return SYMBOLS[code] ?? "৳";
}

/**
 * Format money in BDT style — no decimals.
 * Examples: "৳3,499", "৳80", "৳5,000"
 */
export function formatMoney(amount: number, code: CurrencyCode = STORE_CURRENCY): string {
  const symbol = currencySymbol(code);
  // Format with thousands separator, no decimals
  const formatted = new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return `${symbol}${formatted}`;
}

/* -------------------------------------------------------------------------- */
/*  Store                                                                     */
/* -------------------------------------------------------------------------- */

export const STORE = {
  name: process.env.NEXT_PUBLIC_STORE_NAME ?? "Mukra",
  /** Free shipping threshold in BDT */
  freeShippingThreshold: Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD ?? 5000),
  supportEmail: process.env.STORE_SUPPORT_EMAIL ?? "hello@mukra.com",
} as const;

/* -------------------------------------------------------------------------- */
/*  Shopper-facing category groups                                            */
/* -------------------------------------------------------------------------- */

export interface ShopCategoryConfig {
  title: string;
  /** When present, used as the title in the desktop mega menu. */
  menuTitle?: string;
  slug: string;
  image: string;
  /** Existing and new admin taxonomy values included by this shopper group. */
  productCategories: readonly ProductCategory[];
  subcategories: readonly string[];
}

/**
 * The storefront uses a small editorial taxonomy while products keep their
 * admin taxonomy. Keeping the mapping here makes navigation, filtering and
 * live counts agree without changing legacy product records.
 */
export const SHOP_CATEGORIES = [
  {
    title: "Tops & Tees",
    slug: "tops-tees",
    image: "/images/categories/tops-tees.jpg",
    productCategories: ["Tops & Tees"],
    subcategories: ["Graphic Tees", "Polo Shirts", "Sleeveless"],
  },
  {
    title: "Pants & Bottoms",
    slug: "pants-bottoms",
    image: "/images/categories/pants-bottoms.jpg",
    productCategories: ["Pants & Bottoms", "Winter Bottoms / Trousers"],
    subcategories: ["Trousers", "Shorts", "Leggings", "Denim"],
  },
  {
    title: "Frocks & Dresses",
    slug: "frocks-dresses",
    image: "/images/categories/frocks-dresses.jpg",
    productCategories: ["Frocks & Dresses"],
    subcategories: ["Party Gowns", "Summer Frocks", "Casual Dresses"],
  },
  {
    title: "Outerwear & Jackets",
    menuTitle: "Outerwear",
    slug: "winter-jackets-hoodies",
    image: "/images/categories/outerwear.jpg",
    productCategories: [
      "Outerwear & Jackets",
      "Jackets & Coats",
      "Sweatshirts & Hoodies",
      "Sweaters & Cardigans",
    ],
    subcategories: ["Hoodies", "Jackets", "Winter Sweaters"],
  },
  {
    title: "Kids Accessories",
    slug: "accessories",
    image: "/images/categories/accessories.jpg",
    productCategories: ["Accessories"],
    subcategories: ["Caps", "Socks", "Bags", "Shoes"],
  },
] as const satisfies readonly ShopCategoryConfig[];

/* -------------------------------------------------------------------------- */
/*  Shipping Rates                                                            */
/* -------------------------------------------------------------------------- */

export const SHIPPING_RATES = {
  /** Inside Dhaka — 1-2 days delivery */
  standard: 80,
  /** Outside Dhaka — 3-5 days delivery */
  express: 150,
  /** Gift wrap option */
  giftWrap: 50,
  /** Free shipping threshold */
  freeThreshold: 5000,
} as const;

/* -------------------------------------------------------------------------- */
/*  Payments                                                                  */
/* -------------------------------------------------------------------------- */

const FALLBACK_NUMBERS = ["+8801707302038", "+8801954447017"] as const;

function numbersFromEnv(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [...FALLBACK_NUMBERS];
  const parsed = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...FALLBACK_NUMBERS];
}

export const PAYMENT_NUMBERS = {
  BKASH: numbersFromEnv("PAYMENT_BKASH_NUMBERS"),
  NAGAD: numbersFromEnv("PAYMENT_NAGAD_NUMBERS"),
  ROCKET: numbersFromEnv("PAYMENT_ROCKET_NUMBERS"),
} as const;

export const SSLCOMMERZ = {
  enabled: isSSLCommerzEnabled(),
  storeId: process.env.SSLCOMMERZ_STORE_ID ?? "",
  sandbox: process.env.SSLCOMMERZ_SANDBOX !== "false",
} as const;

/* -------------------------------------------------------------------------- */
/*  Feature flags                                                             */
/* -------------------------------------------------------------------------- */

export const FEATURES = {
  database: isDatabaseConfigured(),
  cloudinary: isCloudinaryConfigured(),
  sslcommerz: SSLCOMMERZ.enabled,
  /** Auth always works — NextAuth with the demo credential fallback. */
  auth: true,
} as const;

/** Auth.js needs a secret; the demo fallback keeps local/dev builds signed-in-able. */
export const AUTH_SECRET =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "little-luxe-demo-secret-change-me-in-production";

export const AUTH_URL =
  process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

/** Server-side summary shown by `/api/health` and the admin console footer. */
export function integrationStatus() {
  return {
    demoMode: !FEATURES.database,
    database: FEATURES.database ? "configured" : "mock",
    cloudinary: FEATURES.cloudinary ? "configured" : "local-disk",
    sslcommerz: FEATURES.sslcommerz ? "enabled" : "disabled",
    currency: STORE_CURRENCY,
  } as const;
}
