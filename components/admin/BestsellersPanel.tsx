"use client";

import { motion } from "framer-motion";
import { cn, formatPrice } from "@/lib/utils";
import { ADMIN_BESTSELLERS } from "@/lib/mock-admin";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Gold / silver / bronze for the podium, neutral for the rest. */
const MEDALS: Readonly<Record<number, string>> = {
  0: "border-primary/45 bg-primary/18 text-primary",
  1: "border-zinc-400/40 bg-zinc-300/12 text-zinc-300",
  2: "border-amber-600/45 bg-amber-700/18 text-amber-500",
};

const MEDAL_EMOJI: Readonly<Record<number, string>> = { 0: "🥇", 1: "🥈", 2: "🥉" };

export function BestsellersPanel({ className }: { className?: string }) {
  const peak = Math.max(...ADMIN_BESTSELLERS.map((entry) => entry.unitsSold), 1);

  return (
    <section className={cn("rounded-xl border border-[#242424] bg-[#141414] p-5", className)}>
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Bestsellers This Week 🏆</h2>
        <p className="mt-1 text-xs text-muted-foreground">Ranked by units sold since Monday</p>
      </header>

      <ol className="flex flex-col gap-3.5">
        {ADMIN_BESTSELLERS.map((entry, index) => (
          <motion.li
            key={entry.productId}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: index * 0.05, ease: EASE }}
            className="flex items-center gap-3"
          >
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums",
                MEDALS[index] ?? "border-[#2A2A2A] bg-white/5 text-muted-foreground",
              )}
              aria-label={`Rank ${index + 1}`}
            >
              {MEDAL_EMOJI[index] ?? index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-xs font-medium text-foreground">{entry.name}</p>
                <p className="shrink-0 text-xs font-medium text-primary tabular-nums">
                  {formatPrice(entry.revenue)}
                </p>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/6">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(entry.unitsSold / peak) * 100}%` }}
                    transition={{ duration: 0.6, delay: 0.1 + index * 0.05, ease: EASE }}
                    className="h-full rounded-full bg-linear-to-r from-primary/50 to-primary"
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                  {entry.unitsSold} units
                </span>
              </div>
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
