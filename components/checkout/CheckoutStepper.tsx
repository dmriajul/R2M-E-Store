"use client";

import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CHECKOUT_STEPS,
  useCheckoutStore,
  type CheckoutStep,
} from "@/store/useCheckoutStore";

/**
 * Four-step progress indicator. The gold fill tracks overall progress, and any
 * step the shopper has already reached stays clickable so they can go back and
 * edit an answer (or jump forward again).
 */
export function CheckoutStepper() {
  const step = useCheckoutStore((state) => state.step);
  const completedSteps = useCheckoutStore((state) => state.completedSteps);
  const setStep = useCheckoutStore((state) => state.setStep);

  const progress = (step / (CHECKOUT_STEPS.length - 1)) * 100;

  return (
    <nav aria-label="Checkout progress" className="w-full">
      <div className="relative">
        {/* Track + gold fill */}
        <div
          aria-hidden
          className="absolute top-5 right-5 left-5 h-0.5 -translate-y-1/2 rounded-full bg-white/10"
        >
          <motion.span
            className="block h-full rounded-full bg-linear-to-r from-primary to-rose"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <ol className="relative flex items-start justify-between gap-2">
          {CHECKOUT_STEPS.map((entry) => {
            const isDone = entry.id < step;
            const isCurrent = entry.id === step;
            const isReached = entry.id <= completedSteps;
            const canJump = isReached && !isCurrent;

            return (
              <li key={entry.id} className="flex flex-1 flex-col items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep(entry.id as CheckoutStep)}
                  disabled={!canJump}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`Step ${entry.id + 1}: ${entry.label}${
                    isDone ? " (completed)" : ""
                  }`}
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full border text-sm font-semibold transition-all duration-500 ease-[var(--ease-luxe)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "border-glass-border bg-[#141414] text-muted-foreground",
                    isReached && !isDone && !isCurrent && "hover:border-primary/50 hover:text-primary",
                    isDone && "border-emerald-500/50 bg-emerald-500/15 text-emerald-400",
                    isCurrent &&
                      "border-primary bg-primary text-primary-foreground shadow-[0_0_26px_-6px_rgba(212,175,55,0.9)]",
                    !canJump && !isCurrent && "cursor-default",
                  )}
                >
                  {isDone ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <span aria-hidden>{entry.id + 1}</span>
                  )}
                </button>

                <span
                  className={cn(
                    "text-center text-[11px] font-medium tracking-[0.12em] uppercase transition-colors duration-300",
                    isCurrent
                      ? "text-primary"
                      : isDone
                        ? "text-emerald-400"
                        : "text-muted-foreground",
                  )}
                >
                  {entry.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
