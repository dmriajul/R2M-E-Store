"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn, formatDayMonth, formatPrice } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/admin/StatusBadge";
import { useAdminStore } from "@/store/useAdminStore";
import type { AdminOrder } from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Compact "latest activity" table — the row expands instead of navigating. */
export function RecentOrdersTable({ limit = 5 }: { limit?: number }) {
  const orders = useAdminStore((state) => state.orders);
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = orders.slice(0, limit);

  return (
    <section className="rounded-xl border border-[#242424] bg-[#141414]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#242424] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Recent Orders</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Latest {rows.length} orders across the store
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-blue-400 transition-colors duration-200 hover:text-blue-300 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
        >
          View All
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#242424] text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
              <th scope="col" className="px-4 py-2.5 text-left font-medium">
                Order #
              </th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">
                Customer
              </th>
              <th scope="col" className="px-4 py-2.5 text-center font-medium">
                Items
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Total
              </th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">
                Date
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((order, index) => (
              <OrderRow
                key={order.id}
                order={order}
                zebra={index % 2 === 1}
                open={openId === order.id}
                onToggle={() => setOpenId((current) => (current === order.id ? null : order.id))}
              />

            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrderRow({
  order,
  zebra,
  open,
  onToggle,
}: {
  order: AdminOrder;
  zebra: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <tr
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "cursor-pointer border-b border-[#1F1F1F] transition-colors duration-200 hover:bg-blue-500/6",
          zebra && !open && "bg-white/[0.015]",
          open && "bg-blue-500/8",
        )}
      >
        <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ChevronDown
              aria-hidden
              className={cn(
                "size-3.5 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
            />
            {order.number}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="block text-foreground">{order.customer.name}</span>
          <span className="block text-[11px] text-muted-foreground">{order.customer.email}</span>
        </td>
        <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">{itemCount}</td>
        <td className="px-4 py-3 text-right font-medium text-foreground tabular-nums">
          {formatPrice(order.totals.total)}
        </td>
        <td className="px-4 py-3">
          <OrderStatusBadge status={order.status} />
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
          {formatDayMonth(order.placedAt)}
        </td>
      </tr>

      <AnimatePresence initial={false}>
        {open && (
          <motion.tr
            key={`${order.id}-details`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="border-b border-[#1F1F1F] bg-[#101010]"
          >
            <td colSpan={6} className="px-4 py-4">
              <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Items
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {order.items.map((item) => (
                      <li
                        key={item.lineId}
                        className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
                      >
                        <span className="truncate">
                          <span aria-hidden className="mr-1.5">
                            {item.emoji}
                          </span>
                          {item.name} · {item.size} · {item.color} × {item.quantity}
                        </span>
                        <span className="tabular-nums">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <dl className="grid content-start gap-1.5 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Payment</dt>
                    <dd className="text-foreground">{order.paymentMethod}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Ship to</dt>
                    <dd className="max-w-[60%] truncate text-right text-foreground">
                      {order.shipping.city}, {order.shipping.country}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="tabular-nums">{formatPrice(order.totals.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Shipping</dt>
                    <dd className="tabular-nums">{formatPrice(order.totals.shipping)}</dd>
                  </div>
                </dl>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}
