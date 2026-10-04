"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Eye, RotateCcw } from "lucide-react";
import { cn, formatPrice, formatShortDate } from "@/lib/utils";
import { isTrackable } from "@/lib/mock-dashboard";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { OrderStatusBadge } from "@/components/dashboard/OrderStatusBadge";
import { OrderTimeline } from "@/components/dashboard/OrderTimeline";
import { useReorder } from "@/components/dashboard/useReorder";
import { Button } from "@/components/ui/button";
import type { CartItem, DashboardOrder } from "@/types";

const EASE_LUXE = [0.22, 1, 0.36, 1] as const;

/** Gradient + emoji thumbnail, matching the bag and checkout summaries. */
export function OrderThumb({
  item,
  className,
}: {
  item: CartItem;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-linear-to-br",
        item.imageGradient,
        className,
      )}
      title={`${item.name} · ${item.color} · ${item.size}`}
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_110%,rgba(10,10,10,0.75)_0%,transparent_70%)]"
      />
      <span aria-hidden className="relative text-lg">
        {item.emoji}
      </span>
    </span>
  );
}

function TotalsRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className={cn("text-muted-foreground", emphasis && "font-medium text-foreground")}>
        {label}
      </span>
      <span className={cn("tabular-nums", emphasis ? "font-bold text-primary" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

interface OrderCardProps {
  order: DashboardOrder;
  index?: number;
  defaultExpanded?: boolean;
  className?: string;
}

/**
 * One order in the list: header, item preview and the actions that apply to its
 * status. Clicking the header expands the full detail — items, totals, the
 * tracking timeline, delivery address and how it was paid.
 */
export function OrderCard({
  order,
  index = 0,
  defaultExpanded = false,
  className,
}: OrderCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const reducedMotion = usePrefersReducedMotion();
  const reorder = useReorder();

  const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const preview = order.items.slice(0, 4);
  const overflow = order.items.length - preview.length;
  const detailHref = `/dashboard/orders/${order.id}`;

  return (
    <motion.article
      layout={!reducedMotion}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion ? 0.2 : 0.45,
        delay: reducedMotion ? 0 : index * 0.06,
        ease: EASE_LUXE,
      }}
      className={cn(
        "glass-soft shadow-playful overflow-hidden rounded-3xl transition-colors duration-500 ease-[var(--ease-luxe)] hover:border-primary/25",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="w-full cursor-pointer p-4 text-left transition-colors duration-300 hover:bg-white/3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{order.number}</span>
              <span className="text-xs text-muted-foreground">
                {formatShortDate(order.placedAt)}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pieces} {pieces === 1 ? "piece" : "pieces"} · {order.deliveryNote}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <OrderStatusBadge status={order.status} />
            <ChevronDown
              aria-hidden
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-400 ease-[var(--ease-luxe)]",
                expanded && "rotate-180",
              )}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {preview.map((item) => (
              <OrderThumb key={item.lineId} item={item} />
            ))}
            {overflow > 0 && (
              <span className="flex size-12 items-center justify-center rounded-xl border border-glass-border bg-white/5 text-xs font-semibold text-muted-foreground">
                +{overflow}
              </span>
            )}
          </div>

          <div className="text-right">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Total
            </p>
            <p className="text-lg font-bold text-primary tabular-nums">
              {formatPrice(order.totals.total)}
            </p>
          </div>
        </div>
      </button>

      {/* ---------- Actions ---------- */}
      <div className="flex flex-wrap items-center gap-2 border-t border-glass-border px-4 py-3 sm:px-5">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-10 rounded-full border-glass-border bg-glass px-4 text-[11px] font-semibold tracking-[0.14em] uppercase transition-colors duration-300 hover:border-primary/40 hover:text-primary"
        >
          <Link href={detailHref}>
            <Eye className="size-3.5" />
            View Details
          </Link>
        </Button>

        {isTrackable(order.status) && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-10 rounded-full border-glass-border bg-glass px-4 text-[11px] font-semibold tracking-[0.14em] uppercase transition-colors duration-300 hover:border-sky-400/40 hover:text-sky-300"
          >
            <Link href={`${detailHref}#tracking`}>
              <span aria-hidden>🚚</span>
              Track
            </Link>
          </Button>
        )}

        {order.status === "delivered" && (
          <Button
            type="button"
            size="sm"
            onClick={() => reorder(order)}
            className="h-10 rounded-full bg-primary px-4 text-[11px] font-semibold tracking-[0.14em] text-primary-foreground uppercase transition-all duration-500 hover:shadow-[0_0_28px_-8px_rgba(212,175,55,0.95)]"
          >
            <RotateCcw className="size-3.5" />
            Reorder
          </Button>
        )}
      </div>

      {/* ---------- Expandable detail ---------- */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.15 : 0.4, ease: EASE_LUXE }}
            className="overflow-hidden"
          >
            <div className="grid gap-6 border-t border-glass-border px-4 py-5 sm:px-5 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                <h3 className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                  Items
                </h3>

                <ul className="flex flex-col gap-3">
                  {order.items.map((item) => (
                    <li key={item.lineId} className="flex items-center gap-3">
                      <OrderThumb item={item} className="size-11" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.color} · {item.size} · ×{item.quantity}
                        </p>
                      </div>
                      <span className="text-sm tabular-nums text-foreground">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col gap-2 rounded-2xl border border-glass-border bg-white/3 p-4">
                  <TotalsRow label="Subtotal" value={formatPrice(order.totals.subtotal)} />
                  <TotalsRow
                    label="Shipping"
                    value={order.totals.shipping === 0 ? "Free" : formatPrice(order.totals.shipping)}
                  />
                  {order.totals.giftWrap > 0 && (
                    <TotalsRow label="Gift wrap" value={formatPrice(order.totals.giftWrap)} />
                  )}
                  {order.totals.discount > 0 && (
                    <TotalsRow label="Discount" value={`−${formatPrice(order.totals.discount)}`} />
                  )}
                  <div className="mt-1 border-t border-glass-border pt-2">
                    <TotalsRow label="Total" value={formatPrice(order.totals.total)} emphasis />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div id="tracking">
                  <h3 className="mb-4 text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                    Tracking
                  </h3>
                  <OrderTimeline steps={order.timeline} />
                </div>

                <div className="rounded-2xl border border-glass-border bg-white/3 p-4 text-sm">
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                    Shipping to
                  </p>
                  <p className="mt-2 font-medium text-foreground">{order.shipping.fullName}</p>
                  <p className="text-muted-foreground">
                    {order.shipping.address.line1}
                    {order.shipping.address.line2 ? `, ${order.shipping.address.line2}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {order.shipping.address.city} {order.shipping.address.postalCode},{" "}
                    {order.shipping.address.country}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {order.shipping.carrier} · {order.shipping.trackingNumber}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Paid with {order.payment.label}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
