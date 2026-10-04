"use client";

import { Lock, ShieldCheck } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { computeTotals, SHIPPING_OPTIONS } from "@/lib/cart";
import { useCartStore } from "@/store/useCartStore";
import { useCheckoutStore } from "@/store/useCheckoutStore";
import { CouponField } from "@/components/cart/CouponField";
import { Separator } from "@/components/ui/separator";
import type { CartItem } from "@/types";

interface OrderSummaryProps {
  /** Overrides the live bag (used by the confirmation step's snapshot). */
  items?: readonly CartItem[];
  /** Hides the coupon field once the order is placed. */
  showCoupon?: boolean;
  className?: string;
}

/** Sticky order recap: lines, subtotal, shipping, wrap, discount, total. */
export function OrderSummary({
  items,
  showCoupon = true,
  className,
}: OrderSummaryProps) {
  const cartItems = useCartStore((state) => state.items);
  const shipping = useCheckoutStore((state) => state.shipping);
  const coupon = useCheckoutStore((state) => state.coupon);

  const lines = items ?? cartItems;
  const totals = computeTotals(lines, {
    method: shipping?.method ?? "standard",
    giftWrap: shipping?.giftWrap ?? false,
    coupon,
  });

  const method = SHIPPING_OPTIONS.find(
    (option) => option.value === (shipping?.method ?? "standard"),
  );

  return (
    <aside
      className={cn(
        "glass-soft flex flex-col gap-5 rounded-3xl border border-glass-border p-5 sm:p-6",
        className,
      )}
      aria-label="Order summary"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-[0.16em] uppercase">
          Order Summary
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/12 px-2.5 py-1 text-[10px] font-medium tracking-wide text-emerald-400">
          <Lock className="size-3" aria-hidden />
          Secure checkout 🔒
        </span>
      </div>

      {/* ---------- Lines ---------- */}
      <ul className="flex max-h-80 flex-col divide-y divide-glass-border overflow-y-auto pr-1">
        {lines.map((item) => (
          <li key={item.lineId} className="flex gap-3 py-3.5 first:pt-0">
            <span
              aria-hidden
              className={cn(
                "relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-linear-to-br text-lg",
                item.imageGradient,
              )}
            >
              <span className="absolute inset-0 bg-[radial-gradient(90%_80%_at_50%_110%,rgba(10,10,10,0.7)_0%,transparent_70%)]" />
              <span className="relative">{item.emoji}</span>
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.color} · {item.size} · ×{item.quantity}
              </p>
            </div>

            <span className="shrink-0 text-sm font-semibold">
              {formatPrice(item.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      {showCoupon && <CouponField />}

      <Separator className="bg-glass-border" />

      {/* ---------- Totals ---------- */}
      <dl className="flex flex-col gap-2.5 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>{formatPrice(totals.subtotal)}</dd>
        </div>

        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">
            Shipping{method ? ` · ${method.label}` : ""}
          </dt>
          <dd className={cn(totals.shipping === 0 && "text-emerald-400")}>
            {totals.shipping === 0 ? "Free 🚚" : formatPrice(totals.shipping)}
          </dd>
        </div>

        {totals.giftWrap > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Gift wrap 🎁</dt>
            <dd>{formatPrice(totals.giftWrap)}</dd>
          </div>
        )}

        {totals.discount > 0 && (
          <div className="flex items-center justify-between text-emerald-400">
            <dt>Discount {coupon ? `(${coupon.percent}%)` : ""}</dt>
            <dd>−{formatPrice(totals.discount)}</dd>
          </div>
        )}

        <div className="mt-1 flex items-baseline justify-between border-t border-glass-border pt-3.5">
          <dt className="text-base font-semibold">Total</dt>
          <dd className="text-2xl font-bold text-primary">
            {formatPrice(totals.total)}
          </dd>
        </div>
      </dl>

      <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5 text-emerald-400" aria-hidden />
        256-bit encrypted · Kid-safe materials guaranteed
      </p>
    </aside>
  );
}
