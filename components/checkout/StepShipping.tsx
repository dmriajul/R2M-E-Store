"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Gift, MapPin } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import {
  COUNTRIES,
  shippingSchema,
  type ShippingValues,
} from "@/lib/validations";
import {
  FREE_SHIPPING_THRESHOLD,
  GIFT_WRAP_FEE,
  getShippingCost,
  SHIPPING_OPTIONS,
} from "@/lib/cart";
import { useCartStore } from "@/store/useCartStore";
import { useCheckoutStore } from "@/store/useCheckoutStore";
import { CheckboxRow, Field, checkoutInputClass } from "@/components/checkout/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Step 2 — delivery address, shipping method and the gift-wrap add-on. */
export function StepShipping() {
  const shipping = useCheckoutStore((state) => state.shipping);
  const setShipping = useCheckoutStore((state) => state.setShipping);
  const goNext = useCheckoutStore((state) => state.goNext);
  const goBack = useCheckoutStore((state) => state.goBack);
  const items = useCartStore((state) => state.items);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const standardCost = getShippingCost("standard", subtotal);
  const expressCost = getShippingCost("express", subtotal);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<ShippingValues>({
    resolver: zodResolver(shippingSchema),
    mode: "onChange",
    defaultValues: shipping ?? {
      fullName: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "Bangladesh",
      saveAddress: true,
      method: "standard",
      giftWrap: false,
    },
  });

  const method = watch("method");
  const giftWrap = watch("giftWrap");

  const onSubmit = (values: ShippingValues) => {
    setShipping(values);
    goNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Shipping Address</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Where should we send the little one&apos;s parcel?
        </p>
      </header>

      <Field label="Full name" htmlFor="ship-name" error={errors.fullName?.message}>
        <Input
          id="ship-name"
          autoComplete="name"
          placeholder="Alex Parker"
          aria-invalid={Boolean(errors.fullName)}
          className={checkoutInputClass}
          {...register("fullName")}
        />
      </Field>

      <Field label="Address line 1" htmlFor="ship-address1" error={errors.address1?.message}>
        <div className="relative">
          <MapPin
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="ship-address1"
            autoComplete="address-line1"
            placeholder="House 12, Road 5, Banani"
            aria-invalid={Boolean(errors.address1)}
            className={`${checkoutInputClass} pl-10`}
            {...register("address1")}
          />
        </div>
      </Field>

      <Field
        label="Address line 2 (optional)"
        htmlFor="ship-address2"
        error={errors.address2?.message}
      >
        <Input
          id="ship-address2"
          autoComplete="address-line2"
          placeholder="Apartment, suite, landmark"
          className={checkoutInputClass}
          {...register("address2")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="City" htmlFor="ship-city" error={errors.city?.message}>
          <Input
            id="ship-city"
            autoComplete="address-level2"
            placeholder="Dhaka"
            aria-invalid={Boolean(errors.city)}
            className={checkoutInputClass}
            {...register("city")}
          />
        </Field>

        <Field
          label="State / Province"
          htmlFor="ship-state"
          error={errors.state?.message}
        >
          <Input
            id="ship-state"
            autoComplete="address-level1"
            placeholder="Dhaka Division"
            className={checkoutInputClass}
            {...register("state")}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="ZIP / Postal code" htmlFor="ship-zip" error={errors.postalCode?.message}>
          <Input
            id="ship-zip"
            autoComplete="postal-code"
            placeholder="1213"
            aria-invalid={Boolean(errors.postalCode)}
            className={checkoutInputClass}
            {...register("postalCode")}
          />
        </Field>

        <Field label="Country" htmlFor="ship-country" error={errors.country?.message}>
          <select
            id="ship-country"
            autoComplete="country-name"
            aria-invalid={Boolean(errors.country)}
            className={cn(
              checkoutInputClass,
              "w-full appearance-none px-3.5 text-foreground",
              /* Chevron drawn inline so the control stays native and accessible. */
              "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23a1a1aa%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px_16px] bg-[position:right_14px_center] bg-no-repeat pr-10",
            )}
            {...register("country")}
          >
            {COUNTRIES.map((country) => (
              <option key={country} value={country} className="bg-[#1A1A1A]">
                {country}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <CheckboxRow
        id="ship-save"
        label="Save this address for next time"
        {...register("saveAddress")}
      />

      {/* ---------- Shipping method ---------- */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Shipping method
        </legend>

        {SHIPPING_OPTIONS.map((option) => {
          const cost = option.value === "standard" ? standardCost : expressCost;
          const selected = method === option.value;

          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-2xl border px-4 py-4 transition-all duration-400 ease-[var(--ease-luxe)]",
                selected
                  ? "border-primary/60 bg-primary/8 shadow-[0_0_30px_-16px_rgba(212,175,55,0.9)]"
                  : "border-glass-border bg-glass hover:border-rose/35",
              )}
            >
              <input
                type="radio"
                value={option.value}
                className="sr-only"
                {...register("method")}
              />
              <span
                aria-hidden
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-300",
                  selected ? "border-primary bg-primary" : "border-glass-border",
                )}
              >
                {selected && <span className="size-2 rounded-full bg-primary-foreground" />}
              </span>

              <span className="text-2xl" aria-hidden>
                {option.emoji}
              </span>

              <span className="flex-1">
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>

              <span
                className={cn(
                  "shrink-0 text-sm font-semibold",
                  cost === 0 ? "text-emerald-400" : "text-foreground",
                )}
              >
                {cost === 0 ? "Free" : formatPrice(cost)}
              </span>
            </label>
          );
        })}

        {standardCost === 0 && (
          <p className="text-xs text-emerald-400">
            Free shipping unlocked — your order is over{" "}
            {formatPrice(FREE_SHIPPING_THRESHOLD)} 🚚
          </p>
        )}
      </fieldset>

      {/* ---------- Gift wrap ---------- */}
      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border px-4 py-4 transition-colors duration-400",
          giftWrap ? "border-rose/45 bg-rose-soft" : "border-glass-border bg-glass",
        )}
      >
        <Gift className="mt-0.5 size-4 shrink-0 text-rose" aria-hidden />
        <div className="flex-1">
          <CheckboxRow
            id="ship-giftwrap"
            label={
              <span className="text-sm text-foreground">
                Add gift wrap (+ {formatPrice(GIFT_WRAP_FEE)})
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Recycled paper, ribbon and a handwritten note 🎁
                </span>
              </span>
            }
            {...register("giftWrap")}
          />
        </div>
      </div>

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
          disabled={!isValid}
          className="group h-13 w-full gap-2 rounded-full bg-primary px-8 text-sm font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.95)] disabled:opacity-45 disabled:shadow-none sm:w-auto motion-safe:hover:not-disabled:scale-[1.02]"
        >
          Continue to Payment
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Button>
      </div>
    </form>
  );
}
