"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Lock, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { COLOR_HEX, DEFAULT_SWATCH } from "@/lib/site";
import { computeTotals, FREE_SHIPPING_THRESHOLD } from "@/lib/cart";
import { useCartStore } from "@/store/useCartStore";
import { useCheckoutStore } from "@/store/useCheckoutStore";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { CouponField } from "@/components/cart/CouponField";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EASE_LUXE = [0.22, 1, 0.36, 1] as const;

/** Gradient thumbnail with the category emoji, keyed off the line's gradient. */
function LineThumbnail({
  gradient,
  emoji,
  size = "md",
}: {
  gradient: string;
  emoji: string;
  size?: "md" | "sm";
}) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-linear-to-br",
        gradient,
        size === "md" ? "size-20" : "size-12",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(90%_80%_at_50%_110%,rgba(10,10,10,0.75)_0%,transparent_70%)]"
      />
      <span
        aria-hidden
        className={cn("relative drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]", size === "md" ? "text-3xl" : "text-lg")}
      >
        {emoji}
      </span>
    </div>
  );
}

/**
 * Shopping bag drawer. Lines are keyed by `lineId`, so the same product in two
 * sizes shows as two rows, and every mutation reads/writes through the cart
 * store. The footer doubles as an order preview: subtotal, shipping estimate,
 * coupon and total.
 */
export function CartSheet({ open, onOpenChange }: CartSheetProps) {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const coupon = useCheckoutStore((state) => state.coupon);
  const reducedMotion = usePrefersReducedMotion();

  const totals = computeTotals(items, { coupon });
  const hasFreeShipping = totals.subtotal >= FREE_SHIPPING_THRESHOLD;
  const progress = Math.min(100, (totals.subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 border-l border-glass-border bg-[#0b0b0b]/95 p-0 backdrop-blur-2xl sm:max-w-md"
      >
        {/* ---------- Header ---------- */}
        <SheetHeader className="shrink-0 border-b border-glass-border px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="flex items-center gap-2 text-base font-semibold tracking-wide">
              <ShoppingBag className="size-4 text-primary" />
              Shopping Bag <span aria-hidden>🛍️</span>
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {totals.subtotal > 0 ? `${items.length} ${items.length === 1 ? "item" : "items"}` : "empty"}
              </span>
            </SheetTitle>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close bag"
                className="text-muted-foreground transition-colors duration-300 hover:text-primary"
              >
                <X className="size-4" />
              </Button>
            </SheetClose>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            {hasFreeShipping
              ? "Free shipping on orders over $50! 🚚"
              : `Add ${formatPrice(totals.amountToFreeShipping)} more for free shipping 🚚`}
          </SheetDescription>

          {/* Free-shipping progress */}
          {items.length > 0 && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <span
                className="block h-full rounded-full bg-linear-to-r from-primary via-rose to-lavender transition-[width] duration-700 ease-[var(--ease-luxe)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </SheetHeader>

        {/* ---------- Items ---------- */}
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="text-6xl" aria-hidden>
              🧸
            </span>
            <h3 className="text-lg font-semibold">Your bag is empty!</h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              Looks like your little one&apos;s wardrobe is waiting to be filled
            </p>
            <Button
              asChild
              onClick={() => onOpenChange(false)}
              className="mt-2 h-11 rounded-full bg-primary px-6 text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 hover:shadow-[0_0_28px_-8px_rgba(212,175,55,0.9)]"
            >
              <Link href="/shop">Start Shopping</Link>
            </Button>
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-glass-border overflow-y-auto overscroll-contain px-5 sm:px-6">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.li
                  key={item.lineId}
                  layout={!reducedMotion}
                  initial={{ opacity: 0, x: reducedMotion ? 0 : 24, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto" }}
                  exit={{ opacity: 0, x: reducedMotion ? 0 : 40, height: 0 }}
                  transition={{ duration: reducedMotion ? 0.2 : 0.35, ease: EASE_LUXE }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-4 py-5">
                    <Link
                      href={`/product/${item.productId}`}
                      onClick={() => onOpenChange(false)}
                      className="shrink-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      aria-label={`View ${item.name}`}
                    >
                      <LineThumbnail gradient={item.imageGradient} emoji={item.emoji} />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/product/${item.productId}`}
                            onClick={() => onOpenChange(false)}
                            className="block truncate text-sm font-medium transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            {item.name}
                          </Link>

                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                aria-hidden
                                className="size-3 rounded-full border border-white/25"
                                style={{
                                  backgroundColor: COLOR_HEX[item.color] ?? DEFAULT_SWATCH,
                                }}
                              />
                              {item.color}
                            </span>
                            <span aria-hidden>·</span>
                            <span className="rounded-full bg-white/8 px-2 py-0.5 font-medium">
                              {item.size}
                            </span>
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            Ages {item.ageRange.replace("Y", "")} ·{" "}
                            <span className="font-semibold text-primary">
                              {formatPrice(item.price)}
                            </span>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.lineId)}
                          aria-label={`Remove ${item.name} from bag`}
                          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors duration-300 hover:bg-rose-soft hover:text-rose focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-1 rounded-full border border-glass-border bg-glass p-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                            aria-label={`Decrease quantity of ${item.name}`}
                            className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-7 text-center text-sm font-semibold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                            disabled={item.quantity >= item.stock}
                            aria-label={`Increase quantity of ${item.name}`}
                            className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>

                        <span className="text-sm font-bold text-primary">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        {/* ---------- Footer / summary ---------- */}
        {items.length > 0 && (
          <div className="shrink-0 border-t border-glass-border bg-black/45 px-5 pt-5 pb-5 backdrop-blur-xl sm:px-6">
            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium">{formatPrice(totals.subtotal)}</dd>
              </div>

              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className={cn(hasFreeShipping ? "text-emerald-400" : "font-medium")}>
                  {hasFreeShipping ? "Free 🚚" : formatPrice(totals.shipping)}
                </dd>
              </div>

              {totals.discount > 0 && (
                <div className="flex items-center justify-between text-emerald-400">
                  <dt>Discount</dt>
                  <dd>−{formatPrice(totals.discount)}</dd>
                </div>
              )}

              <div className="mt-1 flex items-center justify-between border-t border-glass-border pt-3">
                <dt className="text-base font-semibold">Total</dt>
                <dd className="text-xl font-bold text-primary">
                  {formatPrice(totals.total)}
                </dd>
              </div>
            </dl>

            <CouponField className="mt-4" />

            <Button
              asChild
              size="lg"
              onClick={() => onOpenChange(false)}
              className="group mt-5 h-13 w-full gap-2 rounded-full bg-primary text-sm font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_40px_-6px_rgba(212,175,55,0.95)] motion-safe:hover:scale-[1.02]"
            >
              <Link href="/checkout">
                <Lock className="size-4" />
                Checkout
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-3 w-full text-center text-xs tracking-[0.14em] text-muted-foreground uppercase transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
