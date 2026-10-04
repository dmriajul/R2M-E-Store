"use client";

import Link from "next/link";
import { ArrowRight, Gift, ShoppingBag, Sparkles, Ticket } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";
import {
  getActiveOrderCount,
  getLastDeliveredOrder,
  getRecentOrders,
  getRecommendedProducts,
} from "@/lib/mock-dashboard";
import { useDashboardStore } from "@/store/useDashboardStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { StatCard } from "@/components/dashboard/StatCard";
import { OrderCard } from "@/components/dashboard/OrderCard";
import { RecommendedRail } from "@/components/dashboard/RecommendedRail";
import { useReorder } from "@/components/dashboard/useReorder";
import { Button } from "@/components/ui/button";

export default function DashboardOverviewPage() {
  const profile = useDashboardStore((state) => state.profile);
  const seeded = useDashboardStore((state) => state.wishlistSeeded);
  const wishlistCount = useWishlistStore((state) => state.ids.length);
  const reorder = useReorder();

  const recentOrders = getRecentOrders(3);
  const recommended = getRecommendedProducts(4);
  const activeOrders = getActiveOrderCount();
  const firstName = profile.name.split(" ")[0] ?? profile.name;

  return (
    <>
      <title>Dashboard | LITTLE LUXE</title>
      <meta
        name="description"
        content="Track orders, saved pieces, addresses and reward points in your Little Luxe account."
      />
      <meta name="robots" content="noindex" />

      <div className="flex flex-col gap-8">
        {/* ---------- Welcome ---------- */}
        <section className="relative overflow-hidden rounded-3xl border border-glass-border bg-linear-to-br from-gold-soft via-rose-soft to-lavender-soft p-6 sm:p-8">
          <span
            aria-hidden
            className="absolute -top-20 -right-12 size-56 rounded-full bg-primary/25 blur-3xl"
          />
          <div className="relative">
            <p className="text-[11px] font-semibold tracking-[0.24em] text-primary uppercase">
              Your account
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              Welcome back, {firstName}! 👋
            </h1>
            <p className="prose-kids mt-2 max-w-xl text-sm text-muted-foreground">
              Here&apos;s what&apos;s happening with your little one&apos;s wardrobe.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-black/25 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
                <Ticket aria-hidden className="size-3.5 text-primary" />
                {profile.rewardPoints} reward points
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-black/25 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
                <ShoppingBag aria-hidden className="size-3.5 text-primary" />
                {activeOrders} active {activeOrders === 1 ? "order" : "orders"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-black/25 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
                <Sparkles aria-hidden className="size-3.5 text-primary" />
                Member since 2025
              </span>
            </div>
          </div>
        </section>

        {/* ---------- Stats ---------- */}
        <section
          aria-label="Account at a glance"
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          <StatCard
            icon="📦"
            label="Active Orders"
            value={String(activeOrders)}
            hint="On the way right now"
            action={{ label: "Track", href: "/dashboard/orders" }}
            index={0}
          />
          <StatCard
            icon="🧸"
            label="Wishlist Items"
            value={seeded ? String(wishlistCount) : "—"}
            hint="Saved for later"
            action={{ label: "View", href: "/dashboard/wishlist" }}
            index={1}
          />
          <StatCard
            icon="🎁"
            label="Reward Points"
            value={String(profile.rewardPoints)}
            hint="350 points = $10 off"
            action={{
              label: "Redeem",
              onClick: () =>
                toast.info("Rewards catalogue is coming soon 🎁", {
                  description: "Your points are safe — they never expire.",
                }),
            }}
            index={2}
          />
          <StatCard
            icon="💰"
            label="Total Spent"
            value={formatPrice(profile.totalSpent)}
            hint="Across all orders"
            index={3}
          />
        </section>

        {/* ---------- Recent orders ---------- */}
        <section className="flex flex-col gap-4">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight">Recent Orders</h2>
            <Link
              href="/dashboard/orders"
              className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold tracking-[0.14em] text-primary uppercase transition-colors duration-300 hover:text-gold-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              View All
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </header>

          <div className="flex flex-col gap-4">
            {recentOrders.map((order, index) => (
              <OrderCard key={order.id} order={order} index={index} />
            ))}
          </div>
        </section>

        {/* ---------- Recommended ---------- */}
        <section className="flex flex-col gap-4">
          <header>
            <h2 className="text-lg font-bold tracking-tight">
              Your Little One Might Love{" "}
              <span aria-hidden className="emoji-pop">
                💕
              </span>
            </h2>
            <p className="prose-kids mt-1 text-sm text-muted-foreground">
              Picked from the pieces parents come back for.
            </p>
          </header>

          <RecommendedRail products={recommended} />
        </section>

        {/* ---------- Quick actions ---------- */}
        <section aria-label="Quick actions" className="grid gap-3 sm:grid-cols-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const last = getLastDeliveredOrder();
              if (last) reorder(last);
              else
                toast.info("Nothing to reorder yet", {
                  description: "Your first delivered order will show up here.",
                });
            }}
            className="h-14 rounded-full border-glass-border bg-glass text-xs font-semibold tracking-[0.14em] uppercase transition-colors duration-300 hover:border-primary/40 hover:text-primary"
          >
            <ShoppingBag className="size-4" />
            Reorder Last Purchase
          </Button>

          <Button
            asChild
            className="h-14 rounded-full bg-primary text-xs font-semibold tracking-[0.14em] text-primary-foreground uppercase transition-all duration-500 hover:shadow-[0_0_32px_-8px_rgba(212,175,55,0.9)]"
          >
            <Link href="/shop?sort=newest">
              <Sparkles className="size-4" />
              Browse New Arrivals
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              toast.success("Referral link copied 🎁", {
                description: "Friends get 10% off — you get 100 points.",
              })
            }
            className="h-14 rounded-full border-glass-border bg-glass text-xs font-semibold tracking-[0.14em] uppercase transition-colors duration-300 hover:border-rose/40 hover:text-rose"
          >
            <Gift className="size-4" />
            Refer a Friend 🎁
          </Button>
        </section>
      </div>
    </>
  );
}
