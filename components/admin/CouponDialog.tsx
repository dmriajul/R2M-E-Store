"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { COUPON_TYPE_LABEL } from "@/lib/mock-admin";
import {
  COUPON_TYPES,
  adminCouponSchema,
  type AdminCouponFormInput,
  type AdminCouponValues,
} from "@/lib/validations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  AdminField,
  FormSection,
  adminButtonBlue,
  adminButtonGhost,
  adminInputClass,
} from "@/components/admin/Field";
import { useAdminStore } from "@/store/useAdminStore";
import type { AdminCoupon, CouponType } from "@/types";

const CODE_WORDS = ["SPRING", "GLOW", "TREAT", "LUXE", "PLAY", "SPARKLE"];

function randomCode(): string {
  const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)] ?? "LUXE";
  return `${word}${Math.floor(10 + Math.random() * 89)}`;
}

function emptyValues(): AdminCouponFormInput {
  return {
    code: "",
    type: "percentage",
    value: 10,
    minOrder: 0,
    usageLimit: 0,
    startsAt: "2026-10-01",
    endsAt: "2026-12-31",
    categories: [],
    active: true,
  };
}

function valuesFor(coupon: AdminCoupon): AdminCouponFormInput {
  return {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minOrder: coupon.minOrder,
    usageLimit: coupon.usageLimit,
    startsAt: coupon.startsAt,
    endsAt: coupon.endsAt,
    categories: [...coupon.categories],
    active: coupon.active,
  };
}

interface CouponDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null creates a coupon. */
  coupon?: AdminCoupon | null;
  /** Category names offered for targeting. */
  categoryNames: readonly string[];
}

/** Create / edit coupon modal. */
export function CouponDialog({
  open,
  onOpenChange,
  coupon = null,
  categoryNames,
}: CouponDialogProps) {
  const saveCoupon = useAdminStore((state) => state.saveCoupon);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AdminCouponFormInput, unknown, AdminCouponValues>({
    resolver: zodResolver(adminCouponSchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (open) reset(coupon ? valuesFor(coupon) : emptyValues());
  }, [open, coupon, reset]);

  const type = watch("type");
  const active = watch("active");
  const categories = watch("categories") ?? [];

  const toggleCategory = (name: string) => {
    setValue(
      "categories",
      categories.includes(name)
        ? categories.filter((entry) => entry !== name)
        : [...categories, name],
      { shouldDirty: true },
    );
  };

  const onSubmit = handleSubmit((values) => {
    saveCoupon(values, coupon?.id);
    toast.success(coupon ? "Coupon updated! 🏷️" : "Coupon created! 🏷️", {
      description: `${values.code.toUpperCase()} · ${
        type === "percentage"
          ? `${values.value}% off`
          : type === "fixed"
            ? `$${values.value} off`
            : "free shipping"
      }`,
    });
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-[#2A2A2A] bg-[#141414] p-6 sm:max-w-xl">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-sm font-semibold text-foreground">
            {coupon ? `Edit ${coupon.code}` : "Create coupon"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Discount codes are validated client-side in this demo — nothing is redeemed for real.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-6">
          <FormSection title="Code">
            <AdminField
              label="Coupon code"
              htmlFor="coupon-code"
              error={errors.code?.message}
              className="sm:col-span-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="coupon-code"
                  {...register("code")}
                  aria-invalid={Boolean(errors.code)}
                  placeholder="SPRING20"
                  className={cn(
                    adminInputClass,
                    "flex-1 font-mono text-xs uppercase",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setValue("code", randomCode(), { shouldValidate: true })}
                  className={cn(adminButtonGhost, "min-h-10 px-3")}
                >
                  <WandSparkles aria-hidden className="size-3.5" />
                  Generate
                </button>
              </div>
            </AdminField>

            <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
              <legend className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Type
              </legend>
              <div className="flex flex-wrap gap-2">
                {COUPON_TYPES.map((entry: CouponType) => (
                  <label
                    key={entry}
                    className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-xs text-foreground transition-colors duration-200 hover:border-[#3A3A3A] has-checked:border-blue-500/60 has-checked:bg-blue-500/12"
                  >
                    <input
                      type="radio"
                      value={entry}
                      {...register("type")}
                      className="size-3.5 accent-blue-500"
                    />
                    {COUPON_TYPE_LABEL[entry]}
                  </label>
                ))}
              </div>
            </fieldset>
          </FormSection>

          <FormSection title="Value & limits">
            <AdminField
              label={type === "percentage" ? "Percentage off" : "Amount off (USD)"}
              htmlFor="coupon-value"
              error={errors.value?.message}
              hint={type === "free-shipping" ? "Free shipping ignores the value." : undefined}
            >
              <input
                id="coupon-value"
                type="number"
                min="0"
                step="0.01"
                disabled={type === "free-shipping"}
                {...register("value")}
                aria-invalid={Boolean(errors.value)}
                className={cn(adminInputClass, "disabled:opacity-50")}
              />
            </AdminField>

            <AdminField
              label="Minimum order (USD)"
              htmlFor="coupon-min"
              error={errors.minOrder?.message}
            >
              <input
                id="coupon-min"
                type="number"
                min="0"
                step="0.01"
                {...register("minOrder")}
                aria-invalid={Boolean(errors.minOrder)}
                className={adminInputClass}
              />
            </AdminField>

            <AdminField
              label="Usage limit"
              htmlFor="coupon-limit"
              hint="0 = unlimited"
              error={errors.usageLimit?.message}
            >
              <input
                id="coupon-limit"
                type="number"
                min="0"
                step="1"
                {...register("usageLimit")}
                aria-invalid={Boolean(errors.usageLimit)}
                className={adminInputClass}
              />
            </AdminField>

            <div className="grid grid-cols-2 gap-4">
              <AdminField label="Starts" htmlFor="coupon-starts" error={errors.startsAt?.message}>
                <input
                  id="coupon-starts"
                  type="date"
                  {...register("startsAt")}
                  aria-invalid={Boolean(errors.startsAt)}
                  className={adminInputClass}
                />
              </AdminField>
              <AdminField label="Ends" htmlFor="coupon-ends" error={errors.endsAt?.message}>
                <input
                  id="coupon-ends"
                  type="date"
                  {...register("endsAt")}
                  aria-invalid={Boolean(errors.endsAt)}
                  className={adminInputClass}
                />
              </AdminField>
            </div>
          </FormSection>

          <FormSection title="Applies to">
            <fieldset className="sm:col-span-2">
              <legend className="sr-only">Categories</legend>
              <div className="flex flex-wrap gap-2">
                {categoryNames.map((name) => {
                  const checked = categories.includes(name);
                  return (
                    <label
                      key={name}
                      className={cn(
                        "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs transition-colors duration-200",
                        checked
                          ? "border-blue-500/60 bg-blue-500/12 text-foreground"
                          : "border-[#2A2A2A] bg-[#151515] text-muted-foreground hover:border-[#3A3A3A]",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(name)}
                        className="size-3.5 accent-blue-500"
                      />
                      {name}
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                No categories selected = applies to the whole cart.
              </p>
            </fieldset>

            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-xs text-foreground transition-colors duration-200 hover:border-[#3A3A3A] sm:col-span-2">
              <span>
                Active
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Inactive coupons always read as Expired
                </span>
              </span>
              <Switch
                checked={active}
                onCheckedChange={(checked) => setValue("active", checked, { shouldDirty: true })}
                aria-label="Coupon active"
              />
            </label>
          </FormSection>

          <div className="flex flex-col-reverse gap-2 border-t border-[#242424] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn(adminButtonGhost, "min-h-11 sm:min-h-10")}
            >
              Cancel
            </button>
            <button type="submit" className={cn(adminButtonBlue, "min-h-11 sm:min-h-10")}>
              {coupon ? "Save Coupon" : "Create Coupon"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
