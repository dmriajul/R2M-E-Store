"use client";

import { Toaster } from "sonner";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";

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
      /* Every toast carries an icon; the type classes below colour them. */
      icons={{
        success: <CheckCircle2 aria-hidden className="size-5" />,
        error: <XCircle aria-hidden className="size-5" />,
        info: <Info aria-hidden className="size-5" />,
        warning: <AlertTriangle aria-hidden className="size-5" />,
        loading: <Loader2 aria-hidden className="size-5 animate-spin" />,
      }}
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
          // Type colours: success green, error red, info blue, warning amber.
          success: "!text-emerald-400",
          error: "!text-rose",
          info: "!text-sky-400",
          warning: "!text-amber-400",
        },
      }}
    />
  );
}
