"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { getOrderById } from "@/lib/mock-dashboard";
import { OrderDetailView } from "@/components/dashboard/OrderDetailView";
import { Button } from "@/components/ui/button";

export default function DashboardOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const order = getOrderById(id);

  if (!order) {
    return (
      <>
        <title>Order not found | LITTLE LUXE</title>
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
      <title>{`Order ${order.number} | LITTLE LUXE`}</title>
      <meta name="description" content={`Track and review your Little Luxe order ${order.number}.`} />
      <meta name="robots" content="noindex" />

      <OrderDetailView order={order} />
    </>
  );
}
