import type { PaymentStatusKey } from "@/types";
import { PAYMENT_NUMBERS, formatMoney } from "@/lib/config";

/**
 * Payment catalogue.
 *
 * Cash on delivery is the default and the only method that needs no manual
 * step. bKash / Nagad / Rocket are **manual**: the customer sends money to one
 * of the store numbers, keeps the order number as the reference, uploads a
 * screenshot and the admin verifies it. SSLCommerz is a placeholder that stays
 * disabled until a merchant account exists.
 */
export type PaymentKey = "COD" | "BKASH" | "NAGAD" | "ROCKET" | "SSLCOMMERZ";

export interface PaymentMethodConfig {
  key: PaymentKey;
  name: string;
  icon: string;
  description: string;
  /** Extra charge applied on top of the order total. */
  fee: number;
  active: boolean;
  /** Shown until the gateway is enabled. */
  comingSoon?: string;
  /** Wallet / merchant numbers the customer can send money to. */
  numbers?: readonly string[];
  /** Step-by-step copy; `{number}`, `{amount}` and `{orderNumber}` are filled in. */
  instructions?: string;
  /** Rocket uses the *322# USSD flow instead of an app. */
  ussd?: string;
}

const MANUAL_INSTRUCTIONS = [
  "1. Open your {wallet} app",
  "2. Tap 'Send Money'",
  "3. Enter number: {number}",
  "4. Enter amount: {amount}",
  "5. Enter reference: {orderNumber}",
  "6. Complete the payment and upload a screenshot below",
].join("\n");

export const PAYMENT_METHODS: Readonly<Record<PaymentKey, PaymentMethodConfig>> = {
  COD: {
    key: "COD",
    name: "Cash on Delivery",
    icon: "🚚",
    description: "Pay when you receive your order",
    fee: 0,
    active: true,
    instructions: [
      "1. Keep the exact amount ready",
      "2. Our delivery partner collects payment at your doorstep",
      "3. You receive an SMS receipt once the parcel is handed over",
    ].join("\n"),
  },
  BKASH: {
    key: "BKASH",
    name: "bKash",
    icon: "📱",
    description: "Pay via bKash mobile banking",
    fee: 0,
    active: true,
    numbers: PAYMENT_NUMBERS.BKASH,
    instructions: MANUAL_INSTRUCTIONS.replace("{wallet}", "bKash"),
  },
  NAGAD: {
    key: "NAGAD",
    name: "Nagad",
    icon: "📱",
    description: "Pay via Nagad digital financial service",
    fee: 0,
    active: true,
    numbers: PAYMENT_NUMBERS.NAGAD,
    instructions: MANUAL_INSTRUCTIONS.replace("{wallet}", "Nagad"),
  },
  ROCKET: {
    key: "ROCKET",
    name: "Rocket",
    icon: "🚀",
    description: "Pay via Rocket (DBBL)",
    fee: 0,
    active: true,
    numbers: PAYMENT_NUMBERS.ROCKET,
    ussd: "*322#",
    instructions: [
      "1. Dial *322#",
      "2. Select 'Send Money'",
      "3. Enter number: {number}",
      "4. Amount: {amount}",
      "5. Reference: {orderNumber}",
      "6. Complete and upload a screenshot below",
    ].join("\n"),
  },
  SSLCOMMERZ: {
    key: "SSLCOMMERZ",
    name: "Card / Online Banking",
    icon: "💳",
    description: "Pay via SSLCommerz (Visa, Mastercard, Internet Banking)",
    fee: 0,
    active: false,
    comingSoon: "Coming soon! We're setting up secure online payment.",
  },
} as const;

export const DEFAULT_PAYMENT_METHOD: PaymentKey = "COD";

/** Methods a customer may pick right now. */
export function activePaymentMethods(): PaymentMethodConfig[] {
  return Object.values(PAYMENT_METHODS).filter((method) => method.active);
}

/** Methods that need a manual transfer + screenshot verification. */
export const MANUAL_PAYMENT_METHODS: readonly PaymentKey[] = ["BKASH", "NAGAD", "ROCKET"];

export function isManualPayment(method: PaymentKey): boolean {
  return MANUAL_PAYMENT_METHODS.includes(method);
}

export function getPaymentMethod(method: PaymentKey | string): PaymentMethodConfig {
  return PAYMENT_METHODS[method as PaymentKey] ?? PAYMENT_METHODS.COD;
}

/** Fills `{number}` / `{amount}` / `{orderNumber}` in the instruction copy. */
export function renderInstructions(
  method: PaymentKey | string,
  context: { number?: string; amount: number; orderNumber: string },
): string {
  const config = getPaymentMethod(method);
  if (!config.instructions) return "";

  return config.instructions
    .replaceAll("{number}", context.number ?? config.numbers?.[0] ?? "")
    .replaceAll("{amount}", formatMoney(context.amount))
    .replaceAll("{orderNumber}", context.orderNumber);
}

/** One-liner used on the order confirmation page. */
export function paymentSummary(method: PaymentKey | string, total: number): string {
  const config = getPaymentMethod(method);

  if (config.key === "COD") {
    return `Your order is confirmed! Pay ${formatMoney(total)} on delivery 🚚`;
  }
  if (isManualPayment(config.key)) {
    return `Please complete your payment to the number shown. Your order will be confirmed after verification. ${config.icon}`;
  }
  return config.comingSoon ?? "Payment will be collected securely online.";
}

/** COD orders are confirmed immediately but stay unpaid until delivery. */
export function initialOrderState(method: PaymentKey): {
  status: "CONFIRMED" | "PENDING";
  paymentStatus: "UNPAID" | "PENDING";
} {
  return method === "COD"
    ? { status: "CONFIRMED", paymentStatus: "UNPAID" }
    : { status: "PENDING", paymentStatus: "PENDING" };
}

/** "LL-2025-48213" — the human-readable order reference. */
export function generateOrderNumber(year: number = new Date().getFullYear()): string {
  const serial = Math.floor(10000 + Math.random() * 90000);
  return `LL-${year}-${serial}`;
}

/* -------------------------------------------------------------------------- */
/*  Admin helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Maps a human-facing payment label ("bKash •••• 7712", "Visa •••• 2210") to a
 * payment key. Used by the admin console, where mock orders store the label.
 */
export function paymentMethodFromLabel(label: string): PaymentKey | null {
  const value = label.toLowerCase();

  if (value.includes("bkash")) return "BKASH";
  if (value.includes("nagad")) return "NAGAD";
  if (value.includes("rocket")) return "ROCKET";
  if (value.includes("sslcommerz") || value.includes("card") || value.includes("visa")) {
    return "SSLCOMMERZ";
  }
  if (value.includes("cash on delivery") || value.includes("cod")) return "COD";
  return null;
}

export interface PaymentStatusMeta {
  label: string;
  /** Tailwind classes for the small pill in the admin tables. */
  tone: string;
  hint: string;
}

export const PAYMENT_STATUS_META: Readonly<Record<PaymentStatusKey, PaymentStatusMeta>> = {
  UNPAID: {
    label: "Unpaid",
    tone: "border-amber-500/40 bg-amber-500/12 text-amber-300",
    hint: "Cash is collected when the parcel is handed over.",
  },
  PENDING: {
    label: "Pending Verification",
    tone: "border-blue-500/45 bg-blue-500/12 text-blue-300",
    hint: "The customer says they have paid — check the screenshot, then approve.",
  },
  PAID: {
    label: "Paid",
    tone: "border-emerald-500/40 bg-emerald-500/12 text-emerald-300",
    hint: "Money received and matched to this order.",
  },
  FAILED: {
    label: "Rejected",
    tone: "border-rose-500/40 bg-rose-500/12 text-rose-300",
    hint: "The transfer could not be verified; the order was cancelled.",
  },
  REFUNDED: {
    label: "Refunded",
    tone: "border-[#2A2A2A] bg-white/5 text-muted-foreground",
    hint: "Money returned to the customer.",
  },
};
