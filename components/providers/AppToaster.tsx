"use client";

import { Toaster } from "sonner";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";

/**
 * Global toast surface, mounted once in the root layout.
 *
 * Usage: `toast.success("Added to bag! 🛍️")` / `toast.error(...)` /
 * `toast.info(...)`.
 * - Default auto-dismiss timing is 5000ms (5 seconds) for success/info toasts.
 * - Error toasts raised via `authToast` remain visible until dismissed or fixed.
 */
export function AppToaster() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      closeButton
      duration={5000}
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
          // Type colours: success green, error red, info blue, warning yellow/amber.
          success: "!border-emerald-400/40 !text-emerald-400",
          error: "!border-rose/50 !text-rose",
          info: "!border-sky-400/40 !text-sky-400",
          warning: "!border-amber-400/50 !text-amber-400",
        },
      }}
    />
  );
}
