"use client";

import { create } from "zustand";
import type {
  CartItem,
  CouponState,
  OrderPaymentSnapshot,
  PlacedOrder,
  ShippingMethod,
} from "@/types";
import { computeTotals, lookupCoupon, type CartTotals } from "@/lib/cart";
import type {
  ContactValues,
  PaymentValues,
  ShippingValues,
} from "@/lib/validations";

export const CHECKOUT_STEPS = [
  { id: 0, label: "Information" },
  { id: 1, label: "Shipping" },
  { id: 2, label: "Payment" },
  { id: 3, label: "Confirm" },
] as const;

export type CheckoutStep = 0 | 1 | 2 | 3;

interface CheckoutState {
  /** Active step index. */
  step: CheckoutStep;
  /** Furthest step completed, so earlier steps stay clickable. */
  completedSteps: number;
  contact: ContactValues | null;
  shipping: ShippingValues | null;
  payment: PaymentValues | null;
  coupon: CouponState | null;
  /** Mock coupon feedback for the summary row, e.g. "Code applied! -10%". */
  couponMessage: string | null;
  order: PlacedOrder | null;

  setStep: (step: CheckoutStep) => void;
  goNext: () => void;
  goBack: () => void;
  setContact: (values: ContactValues) => void;
  setShipping: (values: ShippingValues) => void;
  setPayment: (values: PaymentValues) => void;
  applyCoupon: (code: string) => boolean;
  clearCoupon: () => void;
  placeOrder: (
    items: readonly CartItem[],
    totals: CartTotals,
    /** Server response when `POST /api/orders` answered; demo values otherwise. */
    meta?: { id?: string; orderNumber?: string; payment?: OrderPaymentSnapshot },
  ) => PlacedOrder;
  reset: () => void;
}

/** "#LL-2025-48213" — cosmetic, generated when the order is placed. */
function generateOrderNumber(): string {
  const serial = Math.floor(10000 + Math.random() * 90000);
  return `#LL-${new Date().getFullYear()}-${serial}`;
}

/** Adds business days (skipping weekends) to today. */
export function addBusinessDays(days: number, from: Date = new Date()): Date {
  const date = new Date(from);
  let remaining = days;

  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }

  return date;
}

export const useCheckoutStore = create<CheckoutState>()((set, get) => ({
  step: 0,
  completedSteps: 0,
  contact: null,
  shipping: null,
  payment: null,
  coupon: null,
  couponMessage: null,
  order: null,

  setStep: (step) => {
    // Only steps already reached may be revisited.
    if (step > get().completedSteps) return;
    set({ step });
  },

  goNext: () =>
    set((state) => {
      const next = Math.min(state.step + 1, 3) as CheckoutStep;
      return { step: next, completedSteps: Math.max(state.completedSteps, next) };
    }),

  goBack: () => set((state) => ({ step: Math.max(state.step - 1, 0) as CheckoutStep })),

  setContact: (contact) => set({ contact }),
  setShipping: (shipping) => set({ shipping }),
  setPayment: (payment) => set({ payment }),

  applyCoupon: (code) => {
    const coupon = lookupCoupon(code);
    if (!coupon) {
      set({ coupon: null, couponMessage: null });
      return false;
    }

    set({
      coupon,
      couponMessage: `Code applied! -${coupon.percent}%`,
    });
    return true;
  },

  clearCoupon: () => set({ coupon: null, couponMessage: null }),

  placeOrder: (items, totals, meta) => {
    const { contact, shipping } = get();
    const method: ShippingMethod = shipping?.method ?? "standard";
    const leadDays = method === "express" ? 3 : 7;

    const order: PlacedOrder = {
      id: meta?.id,
      number: meta?.orderNumber ?? generateOrderNumber(),
      payment: meta?.payment,
      email: contact?.email ?? "",
      placedAt: new Date().toISOString(),
      estimatedDelivery: addBusinessDays(leadDays).toISOString(),
      items: [...items],
      totals: {
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        giftWrap: totals.giftWrap,
        discount: totals.discount,
        total: totals.total,
      },
    };

    set((state) => ({
      order,
      step: 3,
      completedSteps: Math.max(state.completedSteps, 3),
    }));

    return order;
  },

  reset: () =>
    set({
      step: 0,
      completedSteps: 0,
      contact: null,
      shipping: null,
      payment: null,
      coupon: null,
      couponMessage: null,
      order: null,
    }),
}));

/** Convenience selector: live totals for the current bag. */
export function selectCheckoutTotals(items: readonly CartItem[]) {
  const { shipping, coupon } = useCheckoutStore.getState();
  return computeTotals(items, {
    method: shipping?.method ?? "standard",
    giftWrap: shipping?.giftWrap ?? false,
    coupon,
  });
}
