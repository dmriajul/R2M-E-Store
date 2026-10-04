"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn, formatStamp } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import type { OrderTimelineStep } from "@/types";

const EASE_LUXE = [0.22, 1, 0.36, 1] as const;

function StepMarker({ step, index }: { step: OrderTimelineStep; index: number }) {
  const reducedMotion = usePrefersReducedMotion();

  if (step.state === "cancelled") {
    return (
      <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-rose/45 bg-rose-soft text-rose">
        <X aria-hidden className="size-4" />
      </span>
    );
  }

  if (step.state === "done") {
    return (
      <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_22px_-6px_rgba(212,175,55,0.9)]">
        <Check aria-hidden className="size-4" />
      </span>
    );
  }

  if (step.state === "current") {
    return (
      <span className="relative z-10 flex size-9 shrink-0 items-center justify-center">
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full bg-primary/35",
            !reducedMotion && "animate-ping",
          )}
        />
        <span className="relative flex size-9 items-center justify-center rounded-full border-2 border-primary bg-primary/15 text-primary">
          <span aria-hidden className="size-2.5 rounded-full bg-primary" />
        </span>
      </span>
    );
  }

  return (
    <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-muted-foreground">
      {index + 1}
    </span>
  );
}

/**
 * Vertical five-step tracker: gold for completed steps, a pulsing gold ring for
 * the step the parcel is on right now, grey for what's still ahead.
 */
export function OrderTimeline({
  steps,
  className,
}: {
  steps: readonly OrderTimelineStep[];
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <ol className={cn("flex flex-col", className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const next = steps[index + 1];
        const lineComplete =
          step.state === "done" && (next ? next.state !== "pending" : false);

        return (
          <motion.li
            key={step.key}
            initial={{ opacity: 0, x: reducedMotion ? 0 : -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: reducedMotion ? 0.2 : 0.5,
              delay: reducedMotion ? 0 : index * 0.09,
              ease: EASE_LUXE,
            }}
            className="flex gap-4"
          >
            <div className="flex flex-col items-center">
              <StepMarker step={step} index={index} />
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    "w-0.5 flex-1 rounded-full",
                    lineComplete
                      ? "bg-linear-to-b from-primary to-primary/40"
                      : "bg-white/12",
                  )}
                  style={{ minHeight: "2rem" }}
                />
              )}
            </div>

            <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-6")}>
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                <span aria-hidden>{step.emoji}</span>
                <span
                  className={cn(
                    step.state === "pending" && "text-muted-foreground",
                    step.state === "cancelled" && "text-rose",
                  )}
                >
                  {step.label}
                </span>
                {step.state === "current" && (
                  <span className="rounded-full border border-primary/35 bg-gold-soft px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">
                    In progress
                  </span>
                )}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                {step.timestamp ? formatStamp(step.timestamp) : (step.note ?? "Pending")}
                {step.timestamp && step.note ? ` · ${step.note}` : ""}
              </p>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
