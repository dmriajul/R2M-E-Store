/**
 * Central runtime configuration.
 *
 * Everything here reads from the environment but never throws when a value is
 * missing — each getter falls back to the demo value the storefront already
 * uses, so `npm run dev` works on a bare checkout.
 */

import { isCloudinaryConfigured, isDatabaseConfigured, isSSLCommerzEnabled } from "@/lib/demo-mode";

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
  name: process.env.NEXT_PUBLIC_STORE_NAME ?? "Little Luxe",
  /** Free shipping threshold in BDT */
  freeShippingThreshold: Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD ?? 5000),
  supportEmail: process.env.STORE_SUPPORT_EMAIL ?? "hello@littleluxe.com",
} as const;

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
