"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MOCK_ORDERS,
  ORDER_FILTERS,
  countOrdersByStatus,
  getActiveOrderCount,
} from "@/lib/mock-dashboard";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { OrderCard } from "@/components/dashboard/OrderCard";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@/types";

const EASE_LUXE = [0.22, 1, 0.36, 1] as const;

/** Status tabs with the gold underline, and the list of matching orders. */
export function OrdersExplorer() {
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const reducedMotion = usePrefersReducedMotion();

  const orders = useMemo(
    () => (filter === "all" ? [...MOCK_ORDERS] : MOCK_ORDERS.filter((o) => o.status === filter)),
    [filter],
  );

  const activeCount = getActiveOrderCount();

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- Tabs ---------- */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div
          role="tablist"
          aria-label="Filter orders by status"
          className="flex min-w-max items-center gap-1 border-b border-glass-border"
        >
          {ORDER_FILTERS.map((tab) => {
            const active = filter === tab.value;
            const count =
              tab.value === "all" ? MOCK_ORDERS.length : countOrdersByStatus(tab.value);

            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.value)}
                className={cn(
                  "relative flex min-h-11 items-center gap-2 px-3 pt-2 pb-3 text-sm font-medium transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                    active ? "bg-gold-soft text-primary" : "bg-white/6 text-muted-foreground",
                  )}
                >
                  {count}
                </span>
                {active && (
                  <motion.span
                    layoutId="orders-tab-underline"
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                    transition={{ duration: reducedMotion ? 0 : 0.35, ease: EASE_LUXE }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {MOCK_ORDERS.length} orders · {activeCount} on the way 🚚
      </p>

      {/* ---------- List ---------- */}
      <AnimatePresence mode="popLayout" initial={false}>
        {orders.map((order, index) => (
          <OrderCard key={order.id} order={order} index={index} />
        ))}
      </AnimatePresence>

      {orders.length === 0 && (
        <div className="glass-soft flex flex-col items-center gap-4 rounded-3xl border border-glass-border px-6 py-14 text-center">
          <span aria-hidden className="text-5xl">
            {filter === "cancelled" ? "🙈" : "🛍️"}
          </span>
          <h2 className="text-lg font-bold">
            {filter === "all" ? "No orders yet! 🛍️" : `No ${filter} orders`}
          </h2>
          <p className="prose-kids max-w-sm text-sm text-muted-foreground">
            {filter === "all"
              ? "Your little one's wardrobe is waiting to be filled."
              : "Try another filter — the rest of your orders are still here."}
          </p>
          {filter === "all" ? (
            <Button
              asChild
              className="h-12 rounded-full bg-primary px-7 text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 hover:shadow-[0_0_32px_-8px_rgba(212,175,55,0.9)]"
            >
              <Link href="/shop">
                <ShoppingBag className="size-4" />
                Start Shopping
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setFilter("all")}
              className="h-12 rounded-full border-glass-border bg-glass px-7 text-xs font-semibold tracking-[0.16em] uppercase transition-colors duration-300 hover:border-primary/40 hover:text-primary"
            >
              Show all orders
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
