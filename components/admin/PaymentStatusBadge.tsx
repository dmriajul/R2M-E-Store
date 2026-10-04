"use client";

import { cn } from "@/lib/utils";
import { PAYMENT_STATUS_META } from "@/lib/payments";
import type { PaymentStatusKey } from "@/types";

interface PaymentStatusBadgeProps {
  status: PaymentStatusKey;
  dot?: boolean;
  className?: string;
}

/**
 * Compact payment pill used in the orders table and the order sheet.
 *
 * Colours match the rest of the console: amber = waiting for cash, blue =
 * waiting for an operator, emerald = settled, rose = rejected.
 */
export function PaymentStatusBadge({ status, dot = true, className }: PaymentStatusBadgeProps) {
  const meta = PAYMENT_STATUS_META[status];

  return (
    <span
      title={meta.hint}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase",
        meta.tone,
        className,
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {meta.label}
    </span>
  );
}
