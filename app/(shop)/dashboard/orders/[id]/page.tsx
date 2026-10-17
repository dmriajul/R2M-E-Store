"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useDashboardSession } from "@/components/dashboard/DashboardSessionProvider";
import { OrderDetailView } from "@/components/dashboard/OrderDetailView";
import { Button } from "@/components/ui/button";
import { toDashboardOrder } from "@/lib/dashboard-orders";
import type { ApiResponse, DashboardOrder, OrderRecord } from "@/types";

export default function DashboardOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const { user } = useDashboardSession();
  const [order, setOrder] = useState<DashboardOrder | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/orders", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as ApiResponse<OrderRecord[]>;
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error ?? "Could not load this order");
        }
        const record = result.data.find((entry) => entry.id === id || entry.orderNumber === id);
        if (active) setOrder(record ? toDashboardOrder(record) : undefined);
        if (active) setLoading(false);
      })
      .catch((error: unknown) => {
        console.warn("[dashboard] Could not load order details", error);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, user.id]);

  if (loading) {
    return <div className="glass-soft rounded-3xl border border-glass-border p-8 text-center text-sm text-muted-foreground">Loading order details…</div>;
  }

  if (!order) {
    return (
      <>
        <title>Order not found | MUKRA</title>
        <meta name="robots" content="noindex" />

        <div className="glass-soft flex flex-col items-center gap-4 rounded-3xl border border-glass-border px-6 py-16 text-center">
          <span aria-hidden className="text-5xl">
            🧸
          </span>
          <h1 className="text-xl font-bold">We couldn&apos;t find that order</h1>
          <p className="prose-kids max-w-sm text-sm text-muted-foreground">
            The link may be out of date. Your full order history is one tap away.
          </p>
          <Button
            asChild
            className="mt-1 h-12 rounded-full bg-primary px-7 text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 hover:shadow-[0_0_32px_-8px_rgba(212,175,55,0.9)]"
          >
            <Link href="/dashboard/orders">
              <ShoppingBag className="size-4" />
              Back to My Orders
            </Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <title>{`Order ${order.number} | MUKRA`}</title>
      <meta name="description" content={`Track and review your Mukra order ${order.number}.`} />
      <meta name="robots" content="noindex" />

      <OrderDetailView order={order} />
    </>
  );
}
