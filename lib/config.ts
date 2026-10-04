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

/** Demo default is USD — the seeded catalogue is priced in dollars. */
export const STORE_CURRENCY: CurrencyCode = ((): CurrencyCode => {
  const raw = (process.env.NEXT_PUBLIC_CURRENCY ?? "USD").toUpperCase();
  return raw in SYMBOLS ? (raw as CurrencyCode) : "USD";
})();

export function currencySymbol(code: CurrencyCode = STORE_CURRENCY): string {
  return SYMBOLS[code] ?? "$";
}

/** "৳52.98" / "$52.98" — used by the payment instructions and receipts. */
export function formatMoney(amount: number, code: CurrencyCode = STORE_CURRENCY): string {
  return `${currencySymbol(code)}${amount.toFixed(2)}`;
}

/* -------------------------------------------------------------------------- */
/*  Store                                                                     */
/* -------------------------------------------------------------------------- */

export const STORE = {
  name: process.env.NEXT_PUBLIC_STORE_NAME ?? "Little Luxe",
  /** Demo default matches `lib/cart.ts`; override for taka pricing. */
  freeShippingThreshold: Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD ?? 50),
  supportEmail: process.env.STORE_SUPPORT_EMAIL ?? "hello@littleluxe.com",
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
