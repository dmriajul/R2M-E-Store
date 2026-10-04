import type { CartItem, CouponState, ShippingMethod } from "@/types";

/** Bag maths shared by the cart drawer and the checkout summary. */

export const FREE_SHIPPING_THRESHOLD = 50;
export const STANDARD_SHIPPING_FEE = 4.99;
export const EXPRESS_SHIPPING_FEE = 9.99;
export const GIFT_WRAP_FEE = 3.99;
export const MAX_QUANTITY_PER_LINE = 10;

/** Mock coupon table — a real implementation validates server-side. */
export const COUPONS: Readonly<Record<string, number>> = {
  LITTLE10: 10,
  WELCOME15: 15,
  GRANDMA5: 5,
} as const;

export const SHIPPING_OPTIONS: readonly {
  value: ShippingMethod;
  label: string;
  description: string;
  emoji: string;
  fee: number;
  /** Standard shipping becomes free past the threshold. */
  freeOverThreshold: boolean;
}[] = [
  {
    value: "standard",
    label: "Standard",
    description: "5–7 business days",
    emoji: "🚚",
    fee: STANDARD_SHIPPING_FEE,
    freeOverThreshold: true,
  },
  {
    value: "express",
    label: "Express",
    description: "2–3 business days",
    emoji: "⚡",
    fee: EXPRESS_SHIPPING_FEE,
    freeOverThreshold: false,
  },
] as const;

const round = (value: number): number => Math.round(value * 100) / 100;

export function getSubtotal(items: readonly CartItem[]): number {
  return round(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
}

export function getShippingCost(
  method: ShippingMethod,
  subtotal: number,
): number {
  const option = SHIPPING_OPTIONS.find((entry) => entry.value === method);
  if (!option) return 0;

  if (option.freeOverThreshold && subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return option.fee;
}

export function getDiscount(subtotal: number, coupon: CouponState | null): number {
  if (!coupon) return 0;
  return round((subtotal * coupon.percent) / 100);
}

export interface CartTotals {
  subtotal: number;
  shipping: number;
  giftWrap: number;
  discount: number;
  total: number;
  /** Dollars still needed to unlock free shipping (0 once unlocked). */
  amountToFreeShipping: number;
}

export interface TotalsOptions {
  method?: ShippingMethod;
  giftWrap?: boolean;
  coupon?: CouponState | null;
}

export function computeTotals(
  items: readonly CartItem[],
  options: TotalsOptions = {},
): CartTotals {
  const { method = "standard", giftWrap = false, coupon = null } = options;

  const subtotal = getSubtotal(items);
  const shipping = items.length === 0 ? 0 : getShippingCost(method, subtotal);
  const wrap = items.length === 0 ? 0 : giftWrap ? GIFT_WRAP_FEE : 0;
  const discount = getDiscount(subtotal, coupon);

  return {
    subtotal,
    shipping,
    giftWrap: wrap,
    discount,
    total: round(Math.max(0, subtotal + shipping + wrap - discount)),
    amountToFreeShipping: round(Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal)),
  };
}

export function lookupCoupon(code: string): CouponState | null {
  const normalised = code.trim().toUpperCase();
  const percent = COUPONS[normalised];
  return percent ? { code: normalised, percent } : null;
}
