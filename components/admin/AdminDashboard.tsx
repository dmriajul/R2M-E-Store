"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ADMIN_KPIS } from "@/lib/mock-admin";
import { DEMO_NOW } from "@/lib/mock-dashboard";
import { formatLongDate, formatPrice } from "@/lib/utils";
import { ADMIN_ROLE_HINT, ADMIN_ROLE_LABEL } from "@/lib/rbac";
import { KpiCard } from "@/components/admin/KpiCard";
import { RevenuePanel } from "@/components/admin/RevenuePanel";
import { RecentOrdersTable } from "@/components/admin/RecentOrdersTable";
import { BestsellersPanel } from "@/components/admin/BestsellersPanel";
import { LowStockPanel } from "@/components/admin/LowStockPanel";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";
import { useAdminStore } from "@/store/useAdminStore";

const EASE = [0.22, 1, 0.36, 1] as const;

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function ProfitKpiCard({ profit, margin }: { profit: number; margin: number }) {
  return (
    <article className="rounded-xl border border-primary/20 bg-[#0C0C0C] p-4">
      <header className="flex items-center gap-2 text-lg" aria-hidden>
        💹
      </header>
      <p className="mt-3 text-2xl font-bold tracking-tight text-primary tabular-nums sm:text-3xl">
        {formatPrice(profit)}
      </p>
      <p className="mt-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Net Profit (৳)
      </p>
      <p className="mt-3 border-t border-[#242424] pt-2 text-xs text-muted-foreground">
        Net Profit Margin:{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {margin.toFixed(1)}%
        </span>
      </p>
    </article>
  );
}

/**
 * Console dashboard.
 *
 * The greeting and the role pill come from the real session (`useAdminSession`,
 * seeded by `app/admin/layout.tsx`). Panels are rendered per permission, so a
 * support operator gets the order queue and a merchandiser gets stock — the same
 * matrix that guards the routes and the Server Actions.
 */
export default function AdminDashboard() {
  const { user, can } = useAdminSession();
  /* Starts as "Good morning" on the server, then follows the visitor's clock. */
  const [greeting, setGreeting] = useState("Good morning");

  const firstName = user.name.split(/\s+/)[0] || "there";
  const kpis = Array.isArray(ADMIN_KPIS) ? ADMIN_KPIS.filter(Boolean) : [];
  const products = useAdminStore((state) => state.products);
  const orders = useAdminStore((state) => state.orders);

  const costsByProduct = new Map(products.map((product) => [product.id, product.costPrice]));
  const profitTotals = orders
    .filter(
      (order) =>
        order.status === "confirmed" ||
        order.status === "processing" ||
        order.status === "shipped" ||
        order.status === "delivered",
    )
    .flatMap((order) => order.items)
    .reduce(
      (totals, item) => {
        totals.revenue += item.price * item.quantity;
        totals.cost += (costsByProduct.get(item.productId) ?? 0) * item.quantity;
        return totals;
      },
      { revenue: 0, cost: 0 },
    );
  const netProfit = profitTotals.revenue - profitTotals.cost;
  const netProfitMargin =
    profitTotals.revenue > 0 ? (netProfit / profitTotals.revenue) * 100 : 0;

  const seesRevenue = can("analytics:read");
  const seesOrders = can("orders:read");
  /* The low-stock panel restocks (products:write), so inventory + super only. */
  const seesStock = can("products:write");
  const seesBestsellers = can("analytics:read") || can("products:seo");
  const isEmpty = !seesRevenue && !seesOrders && !seesStock && !seesBestsellers;

  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours()));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- Greeting ---------- */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="flex flex-wrap items-end justify-between gap-3"
      >
        <div>
          <p className="text-base font-semibold text-foreground sm:text-lg">
            {greeting}, {firstName}! 👋
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ADMIN_ROLE_HINT[user.role]} — {formatLongDate(DEMO_NOW)}
          </p>
        </div>
        <p className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-1.5 text-[11px] font-medium tracking-[0.1em] text-primary uppercase">
          {ADMIN_ROLE_LABEL[user.role]}
        </p>
      </motion.header>

      {/* ---------- KPIs: revenue/profit is super-admin only ---------- */}
      {seesRevenue && (
        <section
          aria-label="Key performance indicators"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {kpis[0] && <KpiCard key={kpis[0].id} kpi={kpis[0]} index={0} />}
          <ProfitKpiCard profit={netProfit} margin={netProfitMargin} />
          {kpis.slice(1).map((kpi, index) => (
            <KpiCard key={kpi.id} kpi={kpi} index={index + 2} />
          ))}
        </section>
      )}

      {/* ---------- Revenue ---------- */}
      {seesRevenue && <RevenuePanel />}

      {/* ---------- Activity ---------- */}
      {isEmpty ? (
        <p className="rounded-xl border border-[#242424] bg-[#141414] p-5 text-xs text-muted-foreground">
          Nothing to chart for your role yet — use the sidebar to open the sections you
          manage.
        </p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          {seesOrders && <RecentOrdersTable />}
          <div className="flex flex-col gap-5">
            {seesBestsellers && <BestsellersPanel />}
            {seesStock && <LowStockPanel />}
          </div>
        </div>
      )}
    </div>
  );
}
