"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { cn } from "@/lib/utils";
import { AppToaster } from "@/components/providers/AppToaster";

/** Success toasts auto-dismiss after 5 seconds. */
export const SUCCESS_TOAST_DURATION = 5000;

/** Error toasts remain visible until the user dismisses them or fixes the input. */
export const ERROR_TOAST_DURATION = Infinity;

/** Warning toasts remain visible until dismissed or resolved. */
export const WARNING_TOAST_DURATION = Infinity;

export type ToastVariant = "error" | "warning" | "success" | "info";

/**
 * Standardized toast notification helper for authentication and form feedback.
 * - Success messages auto-dismiss after 5 seconds.
 * - Error and warning messages remain visible until dismissed or fixed.
 */
export const authToast = {
  success(title: string, description?: string) {
    return sonnerToast.success(title, {
      description,
      duration: SUCCESS_TOAST_DURATION,
    });
  },
  error(title: string, description?: string) {
    return sonnerToast.error(title, {
      description,
      duration: ERROR_TOAST_DURATION,
    });
  },
  warning(title: string, description?: string) {
    return sonnerToast.warning(title, {
      description,
      duration: WARNING_TOAST_DURATION,
    });
  },
  info(title: string, description?: string) {
    return sonnerToast.info(title, {
      description,
      duration: SUCCESS_TOAST_DURATION,
    });
  },
  dismiss(toastId?: string | number) {
    sonnerToast.dismiss(toastId);
  },
};

export interface InlineToastAlertProps {
  variant?: ToastVariant;
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

const VARIANT_STYLES: Readonly<
  Record<
    ToastVariant,
    {
      container: string;
      icon: React.ReactNode;
      titleColor: string;
      textColor: string;
    }
  >
> = {
  error: {
    container: "border-rose/40 bg-rose/10 text-rose",
    icon: <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-rose" />,
    titleColor: "text-rose font-semibold",
    textColor: "text-rose/90",
  },
  warning: {
    container: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    icon: <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-400" />,
    titleColor: "text-amber-300 font-semibold",
    textColor: "text-amber-200/90",
  },
  success: {
    container: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
    icon: <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-400" />,
    titleColor: "text-emerald-300 font-semibold",
    textColor: "text-emerald-200/90",
  },
  info: {
    container: "border-sky-400/40 bg-sky-400/10 text-sky-200",
    icon: <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-sky-400" />,
    titleColor: "text-sky-300 font-semibold",
    textColor: "text-sky-200/90",
  },
};

/**
 * Dismissible inline notification banner with color coding:
 * - Red for errors
 * - Yellow/Amber for warnings
 * - Green for success
 * - Blue for info
 */
export function Toast({
  variant = "error",
  title,
  message,
  onDismiss,
  className,
}: InlineToastAlertProps) {
  const style = VARIANT_STYLES[variant];

  return (
    <div
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs transition-all duration-300",
        style.container,
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        {style.icon}
        <div className="flex flex-col gap-0.5">
          {title && <p className={style.titleColor}>{title}</p>}
          <p className={style.textColor}>{message}</p>
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className=" shrink-0 rounded-full p-1 opacity-75 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

export { AppToaster };
