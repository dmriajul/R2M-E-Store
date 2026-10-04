"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/useCartStore";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cart preview panel driven by the zustand store. The checkout route lands in
 * a later step — the CTA is intentionally inert for now.
 */
export function CartSheet({ open, onOpenChange }: CartSheetProps) {
  const items = useCartStore((state) => state.items);
  const total = useCartStore((state) => state.total);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-glass-border bg-black/85 backdrop-blur-2xl sm:max-w-md"
      >
        <SheetHeader className="border-b border-glass-border px-6 py-5">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold tracking-wide">
            <ShoppingBag className="size-4 text-primary" />
            Your bag
            {items.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({items.length})
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Complimentary shipping and returns on every order.
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-full border border-glass-border bg-glass">
              <ShoppingBag className="size-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Your bag is empty.
            </p>
            <Button
              asChild
              variant="outline"
              className="border-glass-border bg-glass tracking-[0.14em] uppercase transition-colors duration-300 hover:border-primary/50 hover:text-primary"
            >
              <Link href="/shop" onClick={() => onOpenChange(false)}>
                Browse the collection
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-glass-border overflow-y-auto px-6">
            {items.map((item) => (
              <li key={item.id} className="flex gap-4 py-5">
                <div
                  aria-hidden
                  className="size-16 shrink-0 rounded-lg border border-glass-border bg-gradient-to-br from-white/[0.08] to-transparent"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.product.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.variant?.color ?? item.product.tagline}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${item.product.name}`}
                      onClick={() => removeItem(item.id)}
                      className="text-muted-foreground transition-colors duration-300 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-full border border-glass-border bg-glass">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-primary">
                      {formatPrice(
                        item.product.price * item.quantity,
                        item.product.currency,
                      )}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <SheetFooter className="border-t border-glass-border px-6 py-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-base font-semibold text-primary">
                {formatPrice(total)}
              </span>
            </div>
            <Separator className="my-4 bg-glass-border" />
            <Button
              size="lg"
              className="w-full tracking-[0.18em] uppercase transition-shadow duration-300 hover:shadow-[0_0_32px_-8px_rgba(212,175,55,0.8)]"
            >
              Proceed to checkout
            </Button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Checkout unlocks in the next build step.
            </p>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
