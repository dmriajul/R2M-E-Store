import { cn } from "@/lib/utils";
import { ADMIN_ORDER_STATUS_LABEL, STOCK_STATE_LABEL } from "@/lib/mock-admin";
import type { AdminOrderStatus, CouponStatus, StockState } from "@/types";

export type BadgeTone = "green" | "amber" | "blue" | "red" | "gray" | "violet" | "gold";

/**
 * One palette for every console badge, so a status never changes colour between
 * the orders table, the product table and the sheets.
 */
const TONES: Readonly<Record<BadgeTone, string>> = {
  green: "border-emerald-500/30 bg-emerald-500/12 text-emerald-400",
  amber: "border-amber-500/30 bg-amber-500/12 text-amber-400",
  blue: "border-blue-500/30 bg-blue-500/12 text-blue-400",
  red: "border-rose-500/30 bg-rose-500/12 text-rose-400",
  gray: "border-[#333] bg-white/5 text-muted-foreground",
  violet: "border-violet-500/30 bg-violet-500/12 text-violet-400",
  gold: "border-primary/35 bg-primary/12 text-primary",
};

export function StatusBadge({
  tone,
  label,
  className,
  dot = false,
}: {
  tone: BadgeTone;
  label: string;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {label}
    </span>
  );
}

const ORDER_TONES: Readonly<Record<AdminOrderStatus, BadgeTone>> = {
  pending: "amber",
  processing: "blue",
  shipped: "violet",
  delivered: "green",
  cancelled: "red",
  refunded: "gray",
};

export function OrderStatusBadge({
  status,
  className,
  dot = true,
}: {
  status: AdminOrderStatus;
  className?: string;
  dot?: boolean;
}) {
  return (
    <StatusBadge
      tone={ORDER_TONES[status]}
      label={ADMIN_ORDER_STATUS_LABEL[status]}
      className={className}
      dot={dot}
    />
  );
}

const STOCK_TONES: Readonly<Record<StockState, BadgeTone>> = {
  "in-stock": "green",
  "low-stock": "amber",
  "out-of-stock": "red",
};

export function StockBadge({ state, className }: { state: StockState; className?: string }) {
  return (
    <StatusBadge tone={STOCK_TONES[state]} label={STOCK_STATE_LABEL[state]} className={className} />
  );
}

const COUPON_TONES: Readonly<Record<CouponStatus, BadgeTone>> = {
  active: "green",
  scheduled: "blue",
  expired: "gray",
  depleted: "red",
};

const COUPON_LABEL: Readonly<Record<CouponStatus, string>> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  depleted: "Depleted",
};

export function CouponStatusBadge({
  status,
  className,
}: {
  status: CouponStatus;
  className?: string;
}) {
  return <StatusBadge tone={COUPON_TONES[status]} label={COUPON_LABEL[status]} className={className} />;
}

export function ActiveBadge({ active, className }: { active: boolean; className?: string }) {
  return (
    <StatusBadge
      tone={active ? "green" : "gray"}
      label={active ? "Active" : "Inactive"}
      className={className}
      dot
    />
  );
}
