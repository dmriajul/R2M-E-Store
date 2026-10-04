"use client";

import { Toaster } from "sonner";

/**
 * Global toast surface, mounted once in the root layout.
 *
 * Usage: `toast.success("Added to bag! 🛍️")` / `toast.error(...)` /
 * `toast.info(...)`. The cart store raises the bag toasts, so every add/remove
 * entry point (card, quick view, product page) is covered without extra wiring.
 */
export function AppToaster() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      closeButton
      duration={3200}
      gap={10}
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "glass-strong !rounded-2xl !border-glass-border !bg-[#101010]/95 !text-foreground !shadow-[0_20px_50px_-24px_rgba(0,0,0,0.95)]",
          title: "!text-sm !font-semibold",
          description: "!text-xs !text-muted-foreground",
          actionButton:
            "!rounded-full !bg-primary !text-primary-foreground !text-xs !font-semibold",
          cancelButton: "!rounded-full !bg-white/10 !text-xs",
          closeButton:
            "!rounded-full !border-glass-border !bg-[#101010] !text-muted-foreground",
          success: "!text-emerald-400",
          error: "!text-rose",
          info: "!text-cyan",
        },
      }}
    />
  );
}
