"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { cn, formatPrice, initials } from "@/lib/utils";
import {
  CONVERSION_RATE,
  ORDERS_BY_CATEGORY,
  REVENUE_30D,
  REVENUE_7D,
  TRAFFIC_SOURCES,
  summariseRevenue,
} from "@/lib/mock-admin";
import { BarChart, BreakdownBar } from "@/components/admin/BarChart";
import { useAdminStore } from "@/store/useAdminStore";
import type { BreakdownRow } from "@/types";

type Range = "7d" | "30d";

const RANGES: readonly { id: Range; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<Range>("7d");
  const customers = useAdminStore((state) => state.customers);

  const points = range === "7d" ? REVENUE_7D : REVENUE_30D;
  const summary = summariseRevenue(points);

  const topCustomers = useMemo(
    () => [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5),
    [customers],
  );

  const maxSpend = topCustomers[0]?.totalSpent ?? 1;

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- Range + headline ---------- */}
      <section className="flex flex-col gap-4 rounded-xl border border-[#242424] bg-[#141414] p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Revenue</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {range === "7d" ? "Mon–Sun of the current demo week" : "Daily takings, Sep 2 – Oct 1"}
            </p>
          </div>

          <div
            role="group"
            aria-label="Analytics range"
            className="inline-flex rounded-lg border border-[#2A2A2A] bg-[#101010] p-0.5"
          >
            {RANGES.map((entry) => {
              const active = entry.id === range;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRange(entry.id)}
                  className={cn(
                    "min-h-9 rounded-md px-3 text-xs font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none",
                    active
                      ? "bg-blue-500 text-white"
                      : "text-muted-foreground hover:bg-white/6 hover:text-foreground",
                  )}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Total revenue" value={formatPrice(summary.total)} />
          <Stat label="Average per day" value={formatPrice(summary.average)} />
          <Stat
            label="Avg. order value"
            value={formatPrice(summary.total / CONVERSION_RATE.orders)}
          />
        </div>

        <BarChart
          data={points}
          height={220}
          accent="blue"
          labelEvery={range === "7d" ? 1 : 5}
        />
      </section>

      {/* ---------- Breakdowns ---------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <BreakdownCard
          title="Orders by Category"
          description="Share of units sold this quarter"
          rows={ORDERS_BY_CATEGORY}
          suffix="%"
        />
        <BreakdownCard
          title="Traffic Sources"
          description="Where the sessions come from"
          rows={TRAFFIC_SOURCES}
          suffix="%"
          accent="violet"
        />
      </div>

      {/* ---------- Customers + conversion ---------- */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-[#242424] bg-[#141414] p-5">
          <header className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">Top 5 Customers by Spend</h2>
            <p className="mt-1 text-xs text-muted-foreground">Lifetime value across all orders</p>
          </header>

          <ol className="flex flex-col gap-3.5">
            {topCustomers.map((customer, index) => (
              <motion.li
                key={customer.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05, ease: EASE }}
                className="flex items-center gap-3"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-blue-500/30 bg-blue-500/12 text-[11px] font-semibold text-blue-300">
                  {initials(customer.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-xs font-medium text-foreground">
                      {customer.name}
                    </p>
                    <p className="shrink-0 text-xs font-medium text-primary tabular-nums">
                      {formatPrice(customer.totalSpent)}
                    </p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <BreakdownBar value={customer.totalSpent} max={maxSpend} accent="gold" />
                    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                      {customer.orderCount} orders
                    </span>
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col justify-between gap-4 rounded-xl border border-[#242424] bg-[#141414] p-5">
          <header>
            <h2 className="text-sm font-semibold text-foreground">Conversion Rate</h2>
            <p className="mt-1 text-xs text-muted-foreground">Sessions that turn into orders</p>
          </header>

          <div>
            <p className="text-4xl font-bold tracking-tight text-foreground tabular-nums">
              {CONVERSION_RATE.value.toFixed(1)}%
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-400 tabular-nums">
              <TrendingUp aria-hidden className="size-3" />+{CONVERSION_RATE.trend.toFixed(1)} pts
              vs last period
            </p>
          </div>

          <dl className="grid gap-2 border-t border-[#242424] pt-4 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Sessions</dt>
              <dd className="text-foreground tabular-nums">
                {CONVERSION_RATE.sessions.toLocaleString("en-US")}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Orders</dt>
              <dd className="text-foreground tabular-nums">{CONVERSION_RATE.orders}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Revenue per session</dt>
              <dd className="text-foreground tabular-nums">
                {formatPrice(summary.total / CONVERSION_RATE.sessions)}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <p className="text-[11px] text-muted-foreground">
        All analytics are computed in the browser from the mock dataset — no analytics provider is
        wired up.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-[#242424] bg-[#101010] p-3.5">
      <p className="text-base font-semibold text-foreground tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
    </article>
  );
}

function BreakdownCard({
  title,
  description,
  rows,
  suffix,
  accent = "blue",
}: {
  title: string;
  description: string;
  rows: readonly BreakdownRow[];
  suffix: string;
  accent?: "blue" | "violet";
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <section className="rounded-xl border border-[#242424] bg-[#141414] p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </header>

      <ul className="flex flex-col gap-3.5">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-medium text-foreground">
                {row.label}
                {row.hint && (
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    {row.hint}
                  </span>
                )}
              </p>
              <p className="text-xs text-foreground tabular-nums">
                {row.value}
                {suffix}
              </p>
            </div>
            <BreakdownBar value={row.value} max={max} accent={accent} className="mt-2" />
          </li>
        ))}
      </ul>
    </section>
  );
}
