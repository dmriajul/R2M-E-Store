"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Copy, PackageCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { formatDeliveryDate, formatPrice } from "@/lib/utils";
import { useCheckoutStore } from "@/store/useCheckoutStore";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { Confetti } from "@/components/checkout/Confetti";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/** Step 4 — order placed. Reads the immutable snapshot from the checkout store. */
export function StepConfirmation() {
  const order = useCheckoutStore((state) => state.order);
  const reducedMotion = usePrefersReducedMotion();

  if (!order) return null;

  const copyOrderNumber = async () => {
    try {
      await navigator.clipboard.writeText(order.number);
      toast.success("Order number copied 📋");
    } catch {
      toast.error("Couldn't copy — please copy it manually");
    }
  };

  return (
    <div className="relative flex flex-col gap-8">
      <Confetti />

      {/* ---------- Success ---------- */}
      <div className="relative flex flex-col items-center text-center">
        <motion.span
          initial={{ scale: reducedMotion ? 1 : 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={
            reducedMotion
              ? { duration: 0.3 }
              : { type: "spring", stiffness: 300, damping: 14, mass: 0.8 }
          }
          className="grid size-20 place-items-center rounded-full border-2 border-emerald-500/50 bg-emerald-500/15 shadow-[0_0_50px_-12px_rgba(16,185,129,0.8)]"
        >
          <Check className="size-10 text-emerald-400" strokeWidth={3} aria-hidden />
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Order Placed! 🎉
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-2 max-w-md text-sm text-muted-foreground"
        >
          Thank you for shopping at Little Luxe!
          {order.email && (
            <>
              {" "}
              A confirmation is on its way to{" "}
              <span className="text-foreground">{order.email}</span>.
            </>
          )}
        </motion.p>
      </div>

      {/* ---------- Order meta ---------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass-soft flex items-center justify-between gap-3 rounded-2xl border border-glass-border px-5 py-4">
          <div>
            <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              Order number
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-primary">
              {order.number}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={copyOrderNumber}
            aria-label="Copy order number"
            className="text-muted-foreground transition-colors duration-300 hover:text-primary"
          >
            <Copy className="size-4" />
          </Button>
        </div>

        <div className="glass-soft flex items-center gap-3 rounded-2xl border border-glass-border px-5 py-4">
          <Truck className="size-5 shrink-0 text-rose" aria-hidden />
          <div>
            <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              Estimated delivery
            </p>
            <p className="mt-1 text-sm font-semibold">
              {formatDeliveryDate(order.estimatedDelivery)}
            </p>
            <p className="text-xs text-muted-foreground">
              Your little one&apos;s outfits will arrive by this date
            </p>
          </div>
        </div>
      </div>

      {/* ---------- Summary ---------- */}
      <OrderSummary items={order.items} showCoupon={false} />

      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <PackageCheck className="size-3.5 text-emerald-400" aria-hidden />
        Total paid {formatPrice(order.totals.total)} · Packed in recycled materials ♻️
      </p>

      <Separator className="bg-glass-border" />

      {/* ---------- Next actions ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          asChild
          variant="outline"
          className="h-13 flex-1 rounded-full border-glass-border bg-glass text-xs font-semibold tracking-[0.16em] uppercase transition-colors duration-300 hover:border-primary/50 hover:text-primary"
        >
          <Link href="/dashboard/orders">Track Your Order</Link>
        </Button>

        <Button
          asChild
          className="group h-13 flex-1 gap-2 rounded-full bg-primary text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.95)] motion-safe:hover:scale-[1.02]"
        >
          <Link href="/shop">
            Continue Shopping
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
