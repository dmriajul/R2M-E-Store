"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CreditCard, Store, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GeneralSettingsForm,
  NotificationSettingsForm,
  PaymentsSettingsForm,
  ShippingSettingsForm,
} from "@/components/admin/SettingsForms";

type TabId = "general" | "shipping" | "payments" | "notifications";

const TABS: readonly { id: TabId; label: string; icon: typeof Store }[] = [
  { id: "general", label: "General", icon: Store },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<TabId>("general");

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex flex-wrap gap-2 rounded-xl border border-[#242424] bg-[#141414] p-2"
      >
        {TABS.map((entry) => {
          const active = entry.id === tab;
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(entry.id)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 text-xs font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none",
                active
                  ? "bg-blue-500 text-white"
                  : "text-muted-foreground hover:bg-white/6 hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-3.5" />
              {entry.label}
            </button>
          );
        })}
      </div>

      <section className="rounded-xl border border-[#242424] bg-[#141414] p-5 sm:p-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {tab === "general" && <GeneralSettingsForm />}
            {tab === "shipping" && <ShippingSettingsForm />}
            {tab === "payments" && <PaymentsSettingsForm />}
            {tab === "notifications" && <NotificationSettingsForm />}
          </motion.div>
        </AnimatePresence>
      </section>

      <p className="text-[11px] text-muted-foreground">
        Settings are stored in the client store for this demo — refresh and they reset to the
        seeded values.
      </p>
    </div>
  );
}
