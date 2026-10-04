"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CreditCard, Landmark, Lock, Smartphone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  formatCardNumber,
  formatExpiry,
  paymentSchema,
  type PaymentValues,
} from "@/lib/validations";
import { computeTotals } from "@/lib/cart";
import { useCartStore } from "@/store/useCartStore";
import { useCheckoutStore } from "@/store/useCheckoutStore";
import { Field, checkoutInputClass } from "@/components/checkout/Field";
import { MastercardMark, VisaMark } from "@/components/checkout/CardBrandIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const METHODS = [
  {
    value: "card",
    emoji: "💳",
    label: "Credit / Debit Card",
    description: "Visa, Mastercard, Amex",
    icon: CreditCard,
  },
  {
    value: "mobile",
    emoji: "📱",
    label: "Mobile Payment",
    description: "bKash · Nagad",
    icon: Smartphone,
  },
  {
    value: "sslcommerz",
    emoji: "🏦",
    label: "SSLCommerz",
    description: "Cards, net banking, wallets",
    icon: Landmark,
  },
] as const;

/** Brand colours for the two mobile wallets. */
const WALLETS = [
  { value: "bkash", label: "bKash", color: "#E2136E" },
  { value: "nagad", label: "Nagad", color: "#EE7023" },
] as const;

/** Step 3 — payment method and the final "Place Order" action. */
export function StepPayment() {
  const payment = useCheckoutStore((state) => state.payment);
  const shipping = useCheckoutStore((state) => state.shipping);
  const coupon = useCheckoutStore((state) => state.coupon);
  const setPayment = useCheckoutStore((state) => state.setPayment);
  const placeOrder = useCheckoutStore((state) => state.placeOrder);
  const goBack = useCheckoutStore((state) => state.goBack);

  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const [placing, setPlacing] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    mode: "onChange",
    defaultValues: payment ?? {
      method: "card",
      cardNumber: "",
      cardName: "",
      expiry: "",
      cvv: "",
      mobileProvider: "bkash",
      mobileNumber: "",
    },
  });

  const method = watch("method");
  const mobileProvider = watch("mobileProvider");

  const onSubmit = async (values: PaymentValues) => {
    setPlacing(true);
    setPayment(values);

    // No real processing: simulate the gateway round-trip, then record the order.
    await new Promise((resolve) => setTimeout(resolve, 900));

    const totals = computeTotals(items, {
      method: shipping?.method ?? "standard",
      giftWrap: shipping?.giftWrap ?? false,
      coupon,
    });

    placeOrder(items, totals);
    clearCart();
    setPlacing(false);

    toast.success("Order placed successfully! 🎉", {
      description: "A confirmation email is on its way.",
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Payment Method</h2>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lock className="size-3.5 text-emerald-400" aria-hidden />
          Encrypted end to end. This is a demo — no card is ever charged.
        </p>
      </header>

      {/* ---------- Method tabs ---------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        {METHODS.map((option) => {
          const selected = method === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setValue("method", option.value, { shouldValidate: true })}
              aria-pressed={selected}
              className={cn(
                "flex flex-col items-start gap-2 rounded-2xl border px-4 py-4 text-left transition-all duration-400 ease-[var(--ease-luxe)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                selected
                  ? "border-primary/60 bg-primary/8 shadow-[0_0_30px_-16px_rgba(212,175,55,0.9)]"
                  : "border-glass-border bg-glass hover:border-rose/35",
              )}
            >
              <span className="flex w-full items-center gap-2">
                <span className="text-xl" aria-hidden>
                  {option.emoji}
                </span>
                <span className="flex-1 text-sm font-semibold">{option.label}</span>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-4 place-items-center rounded-full border",
                    selected ? "border-primary bg-primary" : "border-glass-border",
                  )}
                >
                  {selected && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </button>
          );
        })}
      </div>
      <input type="hidden" {...register("method")} />

      {/* ---------- Card ---------- */}
      {method === "card" && (
        <div className="flex flex-col gap-5">
          <Field
            label="Card number"
            htmlFor="pay-card-number"
            error={errors.cardNumber?.message}
          >
            <div className="relative">
              <Input
                id="pay-card-number"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="4111 1111 1111 1111"
                aria-invalid={Boolean(errors.cardNumber)}
                className={`${checkoutInputClass} pr-24 font-mono tracking-wider`}
                {...register("cardNumber", {
                  onChange: (event) => {
                    setValue("cardNumber", formatCardNumber(event.target.value), {
                      shouldValidate: true,
                    });
                  },
                })}
              />
              <span className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1.5">
                <VisaMark className="h-4 w-auto" />
                <MastercardMark className="h-4 w-auto" />
              </span>
            </div>
          </Field>

          <Field label="Name on card" htmlFor="pay-card-name" error={errors.cardName?.message}>
            <Input
              id="pay-card-name"
              autoComplete="cc-name"
              placeholder="ALEX PARKER"
              aria-invalid={Boolean(errors.cardName)}
              className={cn(checkoutInputClass, "uppercase")}
              {...register("cardName")}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Expiry" htmlFor="pay-expiry" error={errors.expiry?.message}>
              <Input
                id="pay-expiry"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                aria-invalid={Boolean(errors.expiry)}
                className={cn(checkoutInputClass, "font-mono tracking-wider")}
                {...register("expiry", {
                  onChange: (event) => {
                    setValue("expiry", formatExpiry(event.target.value), {
                      shouldValidate: true,
                    });
                  },
                })}
              />
            </Field>

            <Field label="CVV" htmlFor="pay-cvv" error={errors.cvv?.message} hint="3 digits on the back">
              <Input
                id="pay-cvv"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                maxLength={4}
                aria-invalid={Boolean(errors.cvv)}
                className={cn(checkoutInputClass, "font-mono tracking-wider")}
                {...register("cvv")}
              />
            </Field>
          </div>
        </div>
      )}

      {/* ---------- Mobile wallet ---------- */}
      {method === "mobile" && (
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Provider
            </legend>
            <div className="flex flex-wrap gap-3">
              {WALLETS.map((wallet) => {
                const selected = mobileProvider === wallet.value;

                return (
                  <button
                    key={wallet.value}
                    type="button"
                    onClick={() =>
                      setValue("mobileProvider", wallet.value, { shouldValidate: true })
                    }
                    aria-pressed={selected}
                    className={cn(
                      "flex items-center gap-2.5 rounded-full border px-5 py-3 text-sm font-semibold transition-all duration-400 ease-[var(--ease-luxe)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      selected
                        ? "text-white shadow-[0_0_28px_-12px_rgba(255,255,255,0.4)]"
                        : "border-glass-border bg-glass text-muted-foreground hover:text-foreground",
                    )}
                    style={
                      selected
                        ? { backgroundColor: wallet.color, borderColor: wallet.color }
                        : undefined
                    }
                  >
                    <span
                      aria-hidden
                      className="grid size-5 place-items-center rounded-full bg-white/25 text-[10px] font-bold"
                    >
                      {wallet.label.charAt(0)}
                    </span>
                    {wallet.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <input type="hidden" {...register("mobileProvider")} />

          <Field
            label="Mobile number"
            htmlFor="pay-mobile"
            error={errors.mobileNumber?.message}
            hint="You'll receive a payment request — approve it to complete your order."
          >
            <Input
              id="pay-mobile"
              type="tel"
              inputMode="tel"
              placeholder="+880 1700 000000"
              aria-invalid={Boolean(errors.mobileNumber)}
              className={checkoutInputClass}
              {...register("mobileNumber")}
            />
          </Field>
        </div>
      )}

      {/* ---------- SSLCommerz ---------- */}
      {method === "sslcommerz" && (
        <div className="glass-soft flex items-start gap-3 rounded-2xl border border-glass-border p-5">
          <Landmark className="mt-0.5 size-5 shrink-0 text-cyan" aria-hidden />
          <div>
            <p className="text-sm font-semibold">Redirect to secure payment</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;ll be taken to SSLCommerz to pay with cards, mobile banking
              or internet banking, then returned here to confirm your order. 🔒
            </p>
          </div>
        </div>
      )}

      {/* ---------- Nav ---------- */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          className="h-12 w-full gap-2 rounded-full border-glass-border bg-glass text-xs font-semibold tracking-[0.16em] uppercase transition-colors duration-300 hover:border-primary/50 hover:text-primary sm:w-auto"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <Button
          type="submit"
          disabled={!isValid || placing}
          className="group h-14 w-full gap-2 rounded-full bg-primary px-8 text-sm font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_46px_-8px_rgba(212,175,55,0.95)] disabled:opacity-45 disabled:shadow-none sm:w-auto motion-safe:hover:not-disabled:scale-[1.02]"
        >
          {placing ? (
            <>
              <span
                aria-hidden
                className="size-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground motion-safe:animate-spin"
              />
              Processing…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Place Order 🎉
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
