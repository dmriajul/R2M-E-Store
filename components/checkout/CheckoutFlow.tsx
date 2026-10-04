"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { useCheckoutStore } from "@/store/useCheckoutStore";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { CheckoutStepper } from "@/components/checkout/CheckoutStepper";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { StepInformation } from "@/components/checkout/StepInformation";
import { StepShipping } from "@/components/checkout/StepShipping";
import { StepPayment } from "@/components/checkout/StepPayment";
import { StepConfirmation } from "@/components/checkout/StepConfirmation";
import { Button } from "@/components/ui/button";

/**
 * Orchestrates the four checkout steps.
 *
 * Step answers live in the checkout store, so moving between steps (and back)
 * never loses input. Steps animate in/out on the X axis; the order summary
 * stays pinned beside them from `lg` up, and on the confirmation step the
 * summary is rendered inside the step itself instead.
 */
export function CheckoutFlow() {
  const step = useCheckoutStore((state) => state.step);
  const order = useCheckoutStore((state) => state.order);
  const items = useCartStore((state) => state.items);
  const reducedMotion = usePrefersReducedMotion();

  const isEmpty = items.length === 0 && !order;

  const stepAnimation = {
    initial: { opacity: 0, x: reducedMotion ? 0 : 32 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: reducedMotion ? 0 : -32 },
    transition: { duration: reducedMotion ? 0.2 : 0.45, ease: [0.22, 1, 0.36, 1] as const },
  };

  /* ---------- Empty bag guard ---------- */
  if (isEmpty) {
    return (
      <div className="glass-soft mx-auto flex max-w-xl flex-col items-center gap-5 rounded-3xl border border-glass-border px-6 py-16 text-center">
        <span className="text-6xl" aria-hidden>
          🧸
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Your bag is empty</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Add a few adorable pieces before heading to checkout — your little
          one&apos;s wardrobe is waiting.
        </p>
        <Button
          asChild
          className="mt-2 h-12 gap-2 rounded-full bg-primary px-7 text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 hover:shadow-[0_0_34px_-8px_rgba(212,175,55,0.9)]"
        >
          <Link href="/shop">
            <ShoppingBag className="size-4" />
            Start Shopping
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <CheckoutStepper />

      <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* ---------- Step body ---------- */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} {...stepAnimation}>
            {step === 0 && <StepInformation />}
            {step === 1 && <StepShipping />}
            {step === 2 && <StepPayment />}
            {step === 3 && <StepConfirmation />}
          </motion.div>
        </AnimatePresence>

        {/* ---------- Sticky summary (steps 1–3) ---------- */}
        {step < 3 && (
          <div className="lg:sticky lg:top-28">
            <OrderSummary className="lg:max-h-[calc(100dvh-9rem)]" />
          </div>
        )}
      </div>
    </div>
  );
}
