"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ADMIN_CURRENCIES, ADMIN_TIMEZONES } from "@/lib/mock-admin";
import {
  settingsGeneralSchema,
  settingsNotificationsSchema,
  settingsPaymentsSchema,
  settingsShippingSchema,
  type SettingsGeneralValues,
  type SettingsNotificationsValues,
  type SettingsPaymentsValues,
  type SettingsShippingFormInput,
  type SettingsShippingValues,
} from "@/lib/validations";
import { Switch } from "@/components/ui/switch";
import {
  AdminField,
  FormSection,
  adminButtonBlue,
  adminInputClass,
  adminSelectClass,
} from "@/components/admin/Field";
import { useAdminStore } from "@/store/useAdminStore";

/** Small shared footer for every settings section. */
function SaveRow({ label = "Save Settings" }: { label?: string }) {
  return (
    <div className="flex justify-end border-t border-[#242424] pt-4">
      <button type="submit" className={cn(adminButtonBlue, "min-h-11 sm:min-h-10")}>
        <Save aria-hidden className="size-3.5" />
        {label}
      </button>
    </div>
  );
}

function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 py-2.5 transition-colors duration-200 hover:border-[#3A3A3A] sm:col-span-2"
    >
      <span>
        <span className="block text-xs font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{description}</span>
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-label={title} />
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/*  General                                                                   */
/* -------------------------------------------------------------------------- */

export function GeneralSettingsForm() {
  const settings = useAdminStore((state) => state.settings);
  const saveSettings = useAdminStore((state) => state.saveSettings);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsGeneralValues>({
    resolver: zodResolver(settingsGeneralSchema),
    defaultValues: settings.general,
  });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        saveSettings({ ...settings, general: values });
        toast.success("General settings saved ✅");
      })}
      className="flex flex-col gap-6"
    >
      <FormSection title="Store details">
        <AdminField label="Store name" htmlFor="store-name" error={errors.storeName?.message}>
          <input
            id="store-name"
            {...register("storeName")}
            aria-invalid={Boolean(errors.storeName)}
            className={adminInputClass}
          />
        </AdminField>

        <AdminField
          label="Support email"
          htmlFor="store-email"
          error={errors.storeEmail?.message}
        >
          <input
            id="store-email"
            type="email"
            {...register("storeEmail")}
            aria-invalid={Boolean(errors.storeEmail)}
            className={adminInputClass}
          />
        </AdminField>

        <AdminField label="Phone" htmlFor="store-phone" error={errors.phone?.message}>
          <input
            id="store-phone"
            {...register("phone")}
            aria-invalid={Boolean(errors.phone)}
            className={adminInputClass}
          />
        </AdminField>

        <AdminField label="Currency" htmlFor="store-currency" error={errors.currency?.message}>
          <select id="store-currency" {...register("currency")} className={adminSelectClass}>
            {ADMIN_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </AdminField>

        <AdminField
          label="Address"
          htmlFor="store-address"
          error={errors.address?.message}
          className="sm:col-span-2"
        >
          <textarea
            id="store-address"
            rows={2}
            {...register("address")}
            aria-invalid={Boolean(errors.address)}
            className={cn(adminInputClass, "h-auto resize-y py-2 leading-relaxed")}
          />
        </AdminField>

        <AdminField label="Timezone" htmlFor="store-timezone" error={errors.timezone?.message}>
          <select id="store-timezone" {...register("timezone")} className={adminSelectClass}>
            {ADMIN_TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </AdminField>
      </FormSection>

      <SaveRow />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shipping                                                                  */
/* -------------------------------------------------------------------------- */

export function ShippingSettingsForm() {
  const settings = useAdminStore((state) => state.settings);
  const saveSettings = useAdminStore((state) => state.saveSettings);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsShippingFormInput, unknown, SettingsShippingValues>({
    resolver: zodResolver(settingsShippingSchema),
    defaultValues: settings.shipping,
  });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        saveSettings({ ...settings, shipping: values });
        toast.success("Shipping settings saved ✅");
      })}
      className="flex flex-col gap-6"
    >
      <FormSection title="Rates" description="Checkout reads these numbers directly.">
        <AdminField
          label="Free shipping threshold (USD)"
          htmlFor="free-threshold"
          error={errors.freeShippingThreshold?.message}
        >
          <input
            id="free-threshold"
            type="number"
            min="0"
            step="0.01"
            {...register("freeShippingThreshold")}
            aria-invalid={Boolean(errors.freeShippingThreshold)}
            className={adminInputClass}
          />
        </AdminField>

        <AdminField
          label="Standard delivery (USD)"
          htmlFor="standard-rate"
          error={errors.standardRate?.message}
        >
          <input
            id="standard-rate"
            type="number"
            min="0"
            step="0.01"
            {...register("standardRate")}
            aria-invalid={Boolean(errors.standardRate)}
            className={adminInputClass}
          />
        </AdminField>

        <AdminField
          label="Express delivery (USD)"
          htmlFor="express-rate"
          error={errors.expressRate?.message}
        >
          <input
            id="express-rate"
            type="number"
            min="0"
            step="0.01"
            {...register("expressRate")}
            aria-invalid={Boolean(errors.expressRate)}
            className={adminInputClass}
          />
        </AdminField>

        <AdminField
          label="Gift wrap (USD)"
          htmlFor="gift-wrap"
          error={errors.giftWrapPrice?.message}
        >
          <input
            id="gift-wrap"
            type="number"
            min="0"
            step="0.01"
            {...register("giftWrapPrice")}
            aria-invalid={Boolean(errors.giftWrapPrice)}
            className={adminInputClass}
          />
        </AdminField>
      </FormSection>

      <SaveRow />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Payments                                                                  */
/* -------------------------------------------------------------------------- */

export function PaymentsSettingsForm() {
  const settings = useAdminStore((state) => state.settings);
  const saveSettings = useAdminStore((state) => state.saveSettings);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SettingsPaymentsValues>({
    resolver: zodResolver(settingsPaymentsSchema),
    defaultValues: settings.payments,
  });

  const stripeEnabled = watch("stripeEnabled");
  const bkashEnabled = watch("bkashEnabled");
  const sslcommerzEnabled = watch("sslcommerzEnabled");

  return (
    <form
      onSubmit={handleSubmit((values) => {
        saveSettings({ ...settings, payments: values });
        toast.success("Payment settings saved ✅");
      })}
      className="flex flex-col gap-6"
    >
      <FormSection
        title="Gateways"
        description="Keys are masked in the demo — no payment is ever processed."
      >
        <AdminField
          label="Stripe secret key"
          htmlFor="stripe-key"
          hint="Stored masked; rotate it in the real dashboard."
          error={errors.stripeKey?.message}
          className="sm:col-span-2"
        >
          <input
            id="stripe-key"
            type="password"
            {...register("stripeKey")}
            aria-invalid={Boolean(errors.stripeKey)}
            className={cn(adminInputClass, "font-mono text-xs")}
          />
        </AdminField>

        <ToggleRow
          id="stripe-enabled"
          title="Stripe"
          description="Card payments for international orders"
          checked={stripeEnabled}
          onChange={(value) => setValue("stripeEnabled", value, { shouldDirty: true })}
        />

        <AdminField
          label="bKash merchant ID"
          htmlFor="bkash-id"
          error={errors.bkashMerchantId?.message}
        >
          <input
            id="bkash-id"
            {...register("bkashMerchantId")}
            aria-invalid={Boolean(errors.bkashMerchantId)}
            className={cn(adminInputClass, "font-mono text-xs")}
          />
        </AdminField>

        <AdminField
          label="SSLCommerz store ID"
          htmlFor="sslcommerz-id"
          error={errors.sslcommerzStoreId?.message}
        >
          <input
            id="sslcommerz-id"
            {...register("sslcommerzStoreId")}
            aria-invalid={Boolean(errors.sslcommerzStoreId)}
            className={cn(adminInputClass, "font-mono text-xs")}
          />
        </AdminField>

        <ToggleRow
          id="bkash-enabled"
          title="bKash"
          description="Mobile wallet for Bangladesh"
          checked={bkashEnabled}
          onChange={(value) => setValue("bkashEnabled", value, { shouldDirty: true })}
        />

        <ToggleRow
          id="sslcommerz-enabled"
          title="SSLCommerz"
          description="Local cards and net banking"
          checked={sslcommerzEnabled}
          onChange={(value) => setValue("sslcommerzEnabled", value, { shouldDirty: true })}
        />
      </FormSection>

      <SaveRow />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Notifications                                                             */
/* -------------------------------------------------------------------------- */

export function NotificationSettingsForm() {
  const settings = useAdminStore((state) => state.settings);
  const saveSettings = useAdminStore((state) => state.saveSettings);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SettingsNotificationsValues>({
    resolver: zodResolver(settingsNotificationsSchema),
    defaultValues: settings.notifications,
  });

  const orderConfirmation = watch("orderConfirmation");
  const shippingUpdate = watch("shippingUpdate");
  const lowStockAlert = watch("lowStockAlert");

  return (
    <form
      onSubmit={handleSubmit((values) => {
        saveSettings({ ...settings, notifications: values });
        toast.success("Notification settings saved ✅");
      })}
      className="flex flex-col gap-6"
    >
      <FormSection title="Email alerts">
        <ToggleRow
          id="notify-order"
          title="Order confirmation"
          description="Email the customer when an order is placed"
          checked={orderConfirmation}
          onChange={(value) => setValue("orderConfirmation", value, { shouldDirty: true })}
        />

        <ToggleRow
          id="notify-shipping"
          title="Shipping updates"
          description="Send tracking details when the carrier scans the parcel"
          checked={shippingUpdate}
          onChange={(value) => setValue("shippingUpdate", value, { shouldDirty: true })}
        />

        <ToggleRow
          id="notify-low-stock"
          title="Low-stock alerts"
          description="Ping the ops inbox when a product drops below its threshold"
          checked={lowStockAlert}
          onChange={(value) => setValue("lowStockAlert", value, { shouldDirty: true })}
        />

        <AdminField
          label="Admin alert email"
          htmlFor="notify-email"
          error={errors.adminEmail?.message}
          className="sm:col-span-2"
        >
          <input
            id="notify-email"
            type="email"
            {...register("adminEmail")}
            aria-invalid={Boolean(errors.adminEmail)}
            className={adminInputClass}
          />
        </AdminField>
      </FormSection>

      <SaveRow />
    </form>
  );
}
