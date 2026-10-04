"use client";

import { Check, Copy, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/config";
import { PAYMENT_METHODS, type PaymentKey } from "@/lib/payments";

interface PaymentMethodPickerProps {
  value: PaymentKey;
  onChange: (method: PaymentKey) => void;
  className?: string;
}

/**
 * The payment-method cards.
 *
 * Only active methods are selectable; the disabled SSLCommerz card stays
 * visible (with a "Coming soon" pill) so shoppers know card payments are on the
 * way. COD is first and selected by default.
 */
export function PaymentMethodPicker({ value, onChange, className }: PaymentMethodPickerProps) {
  const methods = Object.values(PAYMENT_METHODS);

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)} role="radiogroup" aria-label="Payment method">
      {methods.map((method) => {
        const selected = value === method.key;
        const disabled = !method.active;

        return (
          <button
            key={method.key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={disabled}
            disabled={disabled}
            onClick={() => !disabled && onChange(method.key)}
            className={cn(
              "flex min-h-20 flex-col items-start gap-2 rounded-2xl border px-4 py-4 text-left transition-all duration-400 ease-[var(--ease-luxe)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              selected
                ? "border-primary/60 bg-primary/8 shadow-[0_0_30px_-16px_rgba(212,175,55,0.9)]"
                : "border-glass-border bg-glass hover:border-rose/35",
              disabled && "cursor-not-allowed opacity-55 hover:border-glass-border",
            )}
          >
            <span className="flex w-full items-center gap-2">
              <span className="text-xl" aria-hidden>
                {method.icon}
              </span>
              <span className="flex-1 text-sm font-semibold">{method.name}</span>

              {disabled ? (
                <span className="rounded-full border border-glass-border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Coming Soon
                </span>
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    "grid size-4 place-items-center rounded-full border",
                    selected ? "border-primary bg-primary" : "border-glass-border",
                  )}
                >
                  {selected && <Check className="size-2.5 text-primary-foreground" strokeWidth={3} />}
                </span>
              )}
            </span>

            <span className="text-xs text-muted-foreground">{method.description}</span>

            {method.fee > 0 && (
              <span className="text-[11px] text-muted-foreground">
                + {formatMoney(method.fee)} handling fee
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Copy-to-clipboard row used for the wallet numbers and the order reference. */
export function CopyableValue({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied 📋`);
    } catch {
      toast.error("Couldn't copy — please copy it manually");
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-glass-border bg-[#141414] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-0.5 truncate font-mono text-sm text-foreground">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-glass-border text-muted-foreground transition-colors duration-300 hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}

/** Small "demo mode" reassurance strip shared by the payment + confirmation steps. */
export function PaymentSecurityNote({ text }: { text?: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Lock className="size-3.5 text-emerald-400" aria-hidden />
      {text ?? "Encrypted end to end. This is a demo — no real money moves."}
    </p>
  );
}
