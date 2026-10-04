"use client";

import { useState } from "react";
import { ChevronDown, TicketPercent, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCheckoutStore } from "@/store/useCheckoutStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CouponFieldProps {
  /** Renders the trigger as an inline row (drawer) or a plain field (checkout). */
  variant?: "collapsible" | "inline";
  className?: string;
}

/**
 * Coupon entry. Applied codes live in the checkout store so a code entered in
 * the drawer carries through to checkout. Mock table: LITTLE10, WELCOME15,
 * GRANDMA5 (see lib/cart.ts).
 */
export function CouponField({ variant = "collapsible", className }: CouponFieldProps) {
  const coupon = useCheckoutStore((state) => state.coupon);
  const couponMessage = useCheckoutStore((state) => state.couponMessage);
  const applyCoupon = useCheckoutStore((state) => state.applyCoupon);
  const clearCoupon = useCheckoutStore((state) => state.clearCoupon);

  const [open, setOpen] = useState(variant === "inline");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleApply = () => {
    const applied = applyCoupon(code);
    setError(applied ? null : "That code is not valid");
    if (applied) setCode("");
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {variant === "collapsible" && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <TicketPercent className="size-3.5" />
          Have a code?
          <ChevronDown
            className={cn("size-3.5 transition-transform duration-300", open && "rotate-180")}
          />
        </button>
      )}

      {open && (
        <div className="flex items-center gap-2">
          <label htmlFor={`coupon-${variant}`} className="sr-only">
            Discount code
          </label>
          <Input
            id={`coupon-${variant}`}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase());
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleApply();
              }
            }}
            placeholder="LITTLE10"
            className="h-10 flex-1 rounded-xl border-glass-border bg-black/30 text-sm tracking-[0.08em] uppercase placeholder:normal-case focus-visible:border-primary/60 focus-visible:ring-primary/25"
          />
          <Button
            type="button"
            onClick={handleApply}
            variant="outline"
            className="h-10 rounded-full border-glass-border bg-glass px-4 text-xs font-semibold tracking-[0.14em] uppercase transition-colors duration-300 hover:border-primary/50 hover:text-primary"
          >
            Apply
          </Button>
        </div>
      )}

      {couponMessage && coupon && (
        <p className="flex items-center gap-2 text-xs text-emerald-400">
          <span>
            {couponMessage}
            <span className="ml-2 text-muted-foreground">({coupon.code})</span>
          </span>
          <button
            type="button"
            onClick={() => clearCoupon()}
            aria-label={`Remove coupon ${coupon.code}`}
            className="text-muted-foreground transition-colors duration-300 hover:text-rose focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-3.5" />
          </button>
        </p>
      )}

      {error && <p className="text-xs text-rose">{error}</p>}
    </div>
  );
}
