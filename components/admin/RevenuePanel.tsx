"use client";

import { useState } from "react";
import { cn, formatPrice } from "@/lib/utils";
import { REVENUE_30D, REVENUE_7D, summariseRevenue } from "@/lib/mock-admin";
import { BarChart } from "@/components/admin/BarChart";

type Range = "7d" | "30d";

const RANGES: readonly { id: Range; label: string; hint: string }[] = [
  { id: "7d", label: "Last 7 Days", hint: "Mon–Sun" },
  { id: "30d", label: "Last 30 Days", hint: "Sep 2 – Oct 1" },
];

/** Revenue overview card: range toggle, gold bar chart and totals footer. */
export function RevenuePanel({ className }: { className?: string }) {
  const [range, setRange] = useState<Range>("7d");

  const points = range === "7d" ? REVENUE_7D : REVENUE_30D;
  const summary = summariseRevenue(points);

  return (
    <section className={cn("rounded-xl border border-[#242424] bg-[#141414] p-5", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Revenue Overview</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {range === "7d" ? "Daily takings this week" : "Daily takings over the last 30 days"}
          </p>
        </div>

        <div
          role="group"
          aria-label="Revenue range"
          className="inline-flex rounded-lg border border-[#2A2A2A] bg-[#101010] p-0.5"
        >
          {RANGES.map((entry) => {
            const active = entry.id === range;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setRange(entry.id)}
                aria-pressed={active}
                className={cn(
                  "min-h-9 rounded-md px-3 text-xs font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-white/6 hover:text-foreground",
                )}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="mt-5">
        <BarChart
          data={points}
          height={210}
          accent="gold"
          labelEvery={range === "7d" ? 1 : 5}
        />
      </div>

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#242424] pt-4 text-xs">
        <p className="text-muted-foreground">
          Total:{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {formatPrice(summary.total)}
          </span>
        </p>
        <p className="text-muted-foreground">
          Avg:{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {formatPrice(summary.average)}/day
          </span>
        </p>
      </footer>
    </section>
  );
}
