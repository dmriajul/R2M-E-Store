"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ADMIN_KPIS, ADMIN_USER } from "@/lib/mock-admin";
import { DEMO_NOW } from "@/lib/mock-dashboard";
import { formatLongDate } from "@/lib/utils";
import { KpiCard } from "@/components/admin/KpiCard";
import { RevenuePanel } from "@/components/admin/RevenuePanel";
import { RecentOrdersTable } from "@/components/admin/RecentOrdersTable";
import { BestsellersPanel } from "@/components/admin/BestsellersPanel";
import { LowStockPanel } from "@/components/admin/LowStockPanel";

const EASE = [0.22, 1, 0.36, 1] as const;

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function AdminDashboardPage() {
  /* Starts as "Good morning" on the server, then follows the visitor's clock. */
  const [greeting, setGreeting] = useState("Good morning");

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
            {greeting}, {ADMIN_USER.name.split(" ")[0]}! 👋
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Here&rsquo;s how Little Luxe is doing — {formatLongDate(DEMO_NOW)}
          </p>
        </div>
        <p className="rounded-lg border border-[#242424] bg-[#141414] px-3 py-1.5 text-[11px] text-muted-foreground">
          Demo data · no database connected
        </p>
      </motion.header>

      {/* ---------- KPIs ---------- */}
      <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_KPIS.map((kpi, index) => (
          <KpiCard key={kpi.id} kpi={kpi} index={index} />
        ))}
      </section>

      {/* ---------- Revenue ---------- */}
      <RevenuePanel />

      {/* ---------- Activity ---------- */}
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <RecentOrdersTable />
        <div className="flex flex-col gap-5">
          <BestsellersPanel />
          <LowStockPanel />
        </div>
      </div>
    </div>
  );
}
