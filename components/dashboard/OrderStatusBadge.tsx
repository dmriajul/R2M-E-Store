import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_META } from "@/lib/mock-dashboard";
import type { OrderStatus } from "@/types";

/** Colour-coded pill: delivered = green, shipped = blue, processing = amber, cancelled = rose. */
export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const meta = ORDER_STATUS_META[status];

  return (
    <Badge
      className={cn(
        "gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        meta.className,
        className,
      )}
    >
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </Badge>
  );
}
