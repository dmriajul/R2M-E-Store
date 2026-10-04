"use client";

import { motion } from "framer-motion";
import { cn, formatPrice } from "@/lib/utils";
import type { RevenuePoint } from "@/types";

const EASE_LUXE = [0.22, 1, 0.36, 1] as const;

/** Rounds a peak up to a friendly axis maximum (1462 → 2000, 96 → 100). */
function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 2;
  return Math.max(step, Math.ceil(value / step) * step);
}

function compact(value: number): string {
  if (value >= 1000) {
    const thousands = value / 1000;
    return `$${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

interface BarChartProps {
  data: readonly RevenuePoint[];
  /** Plot height in pixels. */
  height?: number;
  accent?: "blue" | "gold";
  /** Show every nth x label — useful for the 30-day series. */
  labelEvery?: number;
  /** Render values as currency (default) or plain numbers. */
  valueFormat?: "currency" | "number";
  className?: string;
}

/**
 * CSS/Tailwind bar chart — no charting dependency. Bars scale against a rounded
 * axis maximum, hover reveals the exact amount, and y-axis gridlines carry the
 * tick labels.
 */
export function BarChart({
  data,
  height = 200,
  accent = "blue",
  labelEvery = 1,
  valueFormat = "currency",
  className,
}: BarChartProps) {
  const max = niceMax(Math.max(...data.map((point) => point.value), 0));
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => (max / tickCount) * index).reverse();

  const format = (value: number) =>
    valueFormat === "currency" ? compact(value) : value.toLocaleString("en-US");

  const barClass =
    accent === "gold"
      ? "bg-linear-to-t from-primary/45 to-primary"
      : "bg-linear-to-t from-blue-600/50 to-blue-400";

  return (
    <div className={cn("flex gap-3", className)}>
      {/* ---------- Y axis ---------- */}
      <div
        className="flex flex-col justify-between text-[10px] text-muted-foreground/80 tabular-nums"
        style={{ height }}
        aria-hidden
      >
        {ticks.map((tick) => (
          <span key={tick}>{format(tick)}</span>
        ))}
      </div>

      {/* ---------- Plot ---------- */}
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {/* Gridlines */}
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((tick) => (
              <span key={tick} className="border-t border-[#242424]" />
            ))}
          </div>

          {/* Bars */}
          <div className="relative flex h-full items-end gap-1">
            {data.map((point, index) => {
              const percent = max === 0 ? 0 : (point.value / max) * 100;

              return (
                <div
                  key={`${point.label}-${index}`}
                  className="group relative flex h-full flex-1 items-end"
                >
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${percent}%` }}
                    transition={{ duration: 0.6, delay: index * 0.02, ease: EASE_LUXE }}
                    className={cn(
                      "w-full rounded-t-sm transition-opacity duration-200 group-hover:opacity-80",
                      barClass,
                    )}
                  />

                  {/* Tooltip */}
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-2 py-1 text-[11px] whitespace-nowrap text-foreground opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100"
                  >
                    <span className="font-medium">{point.label}</span>
                    <span className="ml-1.5 text-muted-foreground tabular-nums">
                      {formatPrice(point.value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------- X axis ---------- */}
        <div className="mt-2 flex gap-1" aria-hidden>
          {data.map((point, index) => (
            <span
              key={`${point.label}-label-${index}`}
              className="flex-1 text-center text-[10px] whitespace-nowrap text-muted-foreground/80"
            >
              {index % labelEvery === 0 ? point.label : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Horizontal percentage bar used by the analytics breakdowns. */
export function BreakdownBar({
  value,
  max = 100,
  accent = "blue",
  className,
}: {
  value: number;
  max?: number;
  accent?: "blue" | "gold" | "violet";
  className?: string;
}) {
  const percent = max === 0 ? 0 : Math.min(100, (value / max) * 100);
  const fill =
    accent === "gold"
      ? "bg-linear-to-r from-primary/50 to-primary"
      : accent === "violet"
        ? "bg-linear-to-r from-violet-600/50 to-violet-400"
        : "bg-linear-to-r from-blue-600/50 to-blue-400";

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-white/6", className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.6, ease: EASE_LUXE }}
        className={cn("h-full rounded-full", fill)}
      />
    </div>
  );
}
