"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { COUNTRIES, addressSchema, type AddressValues } from "@/lib/validations";
import { useDashboardStore } from "@/store/useDashboardStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckboxRow, Field, checkoutInputClass } from "@/components/checkout/Field";
import type { Address } from "@/types";

const EMPTY: AddressValues = {
  label: "Home",
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "Bangladesh",
  phone: "",
  isDefault: false,
};

function toValues(address: Address): AddressValues {
  return {
    label: address.label,
    fullName: address.fullName,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state ?? "",
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone,
    isDefault: address.isDefault,
  };
}

interface AddressFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, `null` when adding. */
  address?: Address | null;
}

/** Add / edit an address. Validation is the shared Zod `addressSchema`. */
export function AddressFormDialog({
  open,
  onOpenChange,
  address = null,
}: AddressFormDialogProps) {
  const addAddress = useDashboardStore((state) => state.addAddress);
  const updateAddress = useDashboardStore((state) => state.updateAddress);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: EMPTY,
  });

  // Re-seed the form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    reset(address ? toValues(address) : EMPTY);
  }, [open, address, reset]);

  const onSubmit = (values: AddressValues) => {
    const payload = {
      ...values,
      line2: values.line2?.trim() ? values.line2.trim() : undefined,
      state: values.state?.trim() ? values.state.trim() : undefined,
    };

    if (address) {
      updateAddress(address.id, payload);
      toast.success("Address updated 📍", { description: `${values.label} is up to date.` });
    } else {
      addAddress(payload);
      toast.success("Address saved 📍", { description: "It's ready to use at checkout." });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-h-[90dvh] max-w-xl overflow-y-auto rounded-3xl border-glass-border">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {address ? "Edit address 📍" : "Add a new address 📍"}
          </DialogTitle>
          <DialogDescription className="prose-kids">
            We only share this with the courier — never with anyone else.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <Field label="Label" htmlFor="address-label" error={errors.label?.message}>
            <input
              id="address-label"
              placeholder="Home, Office, Grandma's…"
              className={cn(checkoutInputClass, "px-3")}
              aria-invalid={Boolean(errors.label)}
              {...register("label")}
            />
          </Field>

          <Field label="Full name" htmlFor="address-name" error={errors.fullName?.message}>
            <input
              id="address-name"
              placeholder="Sarah Ahmed"
              autoComplete="name"
              className={cn(checkoutInputClass, "px-3")}
              aria-invalid={Boolean(errors.fullName)}
              {...register("fullName")}
            />
          </Field>

          <Field
            label="Address line 1"
            htmlFor="address-line1"
            error={errors.line1?.message}
            className="sm:col-span-2"
          >
            <input
              id="address-line1"
              placeholder="House 24, Road 7"
              autoComplete="address-line1"
              className={cn(checkoutInputClass, "px-3")}
              aria-invalid={Boolean(errors.line1)}
              {...register("line1")}
            />
          </Field>

          <Field
            label="Address line 2 (optional)"
            htmlFor="address-line2"
            error={errors.line2?.message}
            className="sm:col-span-2"
          >
            <input
              id="address-line2"
              placeholder="Dhanmondi"
              autoComplete="address-line2"
              className={cn(checkoutInputClass, "px-3")}
              {...register("line2")}
            />
          </Field>

          <Field label="City" htmlFor="address-city" error={errors.city?.message}>
            <input
              id="address-city"
              placeholder="Dhaka"
              autoComplete="address-level2"
              className={cn(checkoutInputClass, "px-3")}
              aria-invalid={Boolean(errors.city)}
              {...register("city")}
            />
          </Field>

          <Field label="State / Division" htmlFor="address-state" error={errors.state?.message}>
            <input
              id="address-state"
              placeholder="Dhaka Division"
              autoComplete="address-level1"
              className={cn(checkoutInputClass, "px-3")}
              {...register("state")}
            />
          </Field>

          <Field label="ZIP / Postal code" htmlFor="address-zip" error={errors.postalCode?.message}>
            <input
              id="address-zip"
              placeholder="1209"
              autoComplete="postal-code"
              className={cn(checkoutInputClass, "px-3")}
              aria-invalid={Boolean(errors.postalCode)}
              {...register("postalCode")}
            />
          </Field>

          <Field label="Country" htmlFor="address-country" error={errors.country?.message}>
            <select
              id="address-country"
              className={cn(checkoutInputClass, "px-3")}
              aria-invalid={Boolean(errors.country)}
              {...register("country")}
            >
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Phone"
            htmlFor="address-phone"
            error={errors.phone?.message}
            className="sm:col-span-2"
          >
            <input
              id="address-phone"
              placeholder="+880 1712 345678"
              autoComplete="tel"
              className={cn(checkoutInputClass, "px-3")}
              aria-invalid={Boolean(errors.phone)}
              {...register("phone")}
            />
          </Field>

          <div className="sm:col-span-2">
            <CheckboxRow
              id="address-default"
              label="Make this my default address"
              {...register("isDefault")}
            />
          </div>

          <DialogFooter className="gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-full border-glass-border bg-glass text-xs font-semibold tracking-[0.14em] uppercase transition-colors duration-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 rounded-full bg-primary text-xs font-semibold tracking-[0.14em] text-primary-foreground uppercase transition-all duration-500 hover:shadow-[0_0_28px_-8px_rgba(212,175,55,0.9)]"
            >
              {address ? "Save Changes" : "Save Address"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
