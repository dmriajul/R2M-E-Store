"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { adminCardClass } from "@/components/admin/Field";
import type { AdminKpi } from "@/types";

/** One KPI tile: value, trend and a CSS-only sparkline. */
export function KpiCard({ kpi, index = 0 }: { kpi: AdminKpi; index?: number }) {
  const up = kpi.trend >= 0;
  const peak = Math.max(...kpi.spark, 1);
  const trendLabel = `${up ? "+" : "−"}${Math.abs(kpi.trend)}${kpi.trendUnit === "percent" ? "%" : ""}`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className={cn(adminCardClass, "flex flex-col gap-3 p-4 hover:border-blue-500/30")}
    >
      <header className="flex items-start justify-between gap-3">
        <span aria-hidden className="text-lg">
          {kpi.emoji}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
            up ? "bg-emerald-500/12 text-emerald-400" : "bg-rose-500/12 text-rose-400",
          )}
        >
          {up ? (
            <TrendingUp aria-hidden className="size-3" />
          ) : (
            <TrendingDown aria-hidden className="size-3" />
          )}
          {trendLabel}
        </span>
      </header>

      <div>
        <p className="text-2xl font-bold tracking-tight text-primary tabular-nums sm:text-3xl">
          {kpi.value}
        </p>
        <p className="mt-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {kpi.label}
        </p>
      </div>

      {/* Sparkline — bars scaled against the series peak. */}
      <div className="flex h-8 items-end gap-1" aria-hidden>
        {kpi.spark.map((point, pointIndex) => (
          <span
            key={pointIndex}
            className={cn(
              "flex-1 rounded-sm bg-blue-500/35",
              pointIndex === kpi.spark.length - 1 && "bg-blue-400",
            )}
            style={{ height: `${Math.max(8, (point / peak) * 100)}%` }}
          />
        ))}
      </div>
    </motion.article>
  );
}
