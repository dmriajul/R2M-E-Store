"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  GENDER_OPTIONS,
  passwordChangeSchema,
  profileSchema,
  type PasswordChangeValues,
  type ProfileValues,
} from "@/lib/validations";
import { useDashboardStore } from "@/store/useDashboardStore";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { Field, checkoutInputClass } from "@/components/checkout/Field";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { DashboardPreferenceKey } from "@/types";

function Panel({
  title,
  description,
  icon,
  children,
  tone = "default",
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      className={cn(
        "glass-soft flex flex-col gap-5 rounded-3xl border p-5 sm:p-6",
        tone === "danger" ? "border-rose/30" : "border-glass-border",
      )}
    >
      <header className="flex flex-col gap-1">
        <h2
          className={cn(
            "flex items-center gap-2 text-base font-bold tracking-tight",
            tone === "danger" && "text-rose",
          )}
        >
          {icon}
          {title}
        </h2>
        {description && (
          <p className="prose-kids text-sm text-muted-foreground">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
}

/** Name, email, phone, birthday and gender. */
export function ProfileDetailsForm() {
  const profile = useDashboardStore((state) => state.profile);
  const updateProfile = useDashboardStore((state) => state.updateProfile);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile.name,
      email: profile.email,
      phone: profile.phone,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender,
    },
  });

  const onSubmit = (values: ProfileValues) => {
    updateProfile({
      name: values.fullName,
      email: values.email,
      phone: values.phone,
      dateOfBirth: values.dateOfBirth,
      gender: values.gender,
    });
    reset(values);
    toast.success("Profile updated ✨", { description: "Your details are saved." });
  };

  return (
    <Panel
      title="Edit Profile"
      description="Keep your details current so deliveries and updates reach you."
      icon={<Sparkles aria-hidden className="size-4 text-primary" />}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="profile-name" error={errors.fullName?.message}>
          <input
            id="profile-name"
            className={cn(checkoutInputClass, "px-3")}
            aria-invalid={Boolean(errors.fullName)}
            {...register("fullName")}
          />
        </Field>

        <Field
          label="Email (read-only)"
          htmlFor="profile-email"
          error={errors.email?.message}
          hint="Contact support to change your login email."
        >
          <input
            id="profile-email"
            type="email"
            disabled
            className={cn(checkoutInputClass, "cursor-not-allowed px-3 opacity-60")}
            {...register("email")}
          />
        </Field>

        <Field label="Phone" htmlFor="profile-phone" error={errors.phone?.message}>
          <input
            id="profile-phone"
            autoComplete="tel"
            className={cn(checkoutInputClass, "px-3")}
            aria-invalid={Boolean(errors.phone)}
            {...register("phone")}
          />
        </Field>

        <Field label="Date of birth" htmlFor="profile-dob" error={errors.dateOfBirth?.message}>
          <input
            id="profile-dob"
            type="date"
            className={cn(checkoutInputClass, "px-3")}
            aria-invalid={Boolean(errors.dateOfBirth)}
            {...register("dateOfBirth")}
          />
        </Field>

        <Field label="Gender" htmlFor="profile-gender" error={errors.gender?.message}>
          <select
            id="profile-gender"
            className={cn(checkoutInputClass, "px-3")}
            aria-invalid={Boolean(errors.gender)}
            {...register("gender")}
          >
            {GENDER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-end sm:col-span-2">
          <Button
            type="submit"
            disabled={!isDirty}
            className="h-12 w-full rounded-full bg-primary text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 hover:shadow-[0_0_30px_-8px_rgba(212,175,55,0.9)] disabled:opacity-40 sm:w-auto sm:px-8"
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/** Current / new / confirm, with the shared strength meter. */
export function PasswordCard() {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const newPassword = watch("newPassword");

  const onSubmit = () => {
    reset();
    toast.success("Password updated 🔒", {
      description: "Use your new password next time you sign in.",
    });
  };

  return (
    <Panel
      title="Change Password"
      description="Pick something long and memorable — at least 8 characters."
      icon={<KeyRound aria-hidden className="size-4 text-primary" />}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <Field label="Current password" htmlFor="pw-current" error={errors.currentPassword?.message}>
          <input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            className={cn(checkoutInputClass, "px-3")}
            aria-invalid={Boolean(errors.currentPassword)}
            {...register("currentPassword")}
          />
        </Field>

        <Field
          label="New password"
          htmlFor="pw-new"
          error={errors.newPassword?.message}
          hint="Mix upper case, numbers and a symbol."
        >
          <input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            className={cn(checkoutInputClass, "px-3")}
            aria-invalid={Boolean(errors.newPassword)}
            {...register("newPassword")}
          />
        </Field>

        {newPassword.length > 0 && <PasswordStrength value={newPassword} />}

        <Field
          label="Confirm new password"
          htmlFor="pw-confirm"
          error={errors.confirmPassword?.message}
        >
          <input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            className={cn(checkoutInputClass, "px-3")}
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register("confirmPassword")}
          />
        </Field>

        <Button
          type="submit"
          className="h-12 w-full rounded-full border border-glass-border bg-glass text-xs font-semibold tracking-[0.16em] uppercase transition-colors duration-300 hover:border-primary/40 hover:text-primary sm:w-auto sm:px-8"
        >
          Update Password
        </Button>
      </form>
    </Panel>
  );
}

const PREFERENCES: readonly {
  key: DashboardPreferenceKey;
  label: string;
  description: string;
}[] = [
  {
    key: "emailNotifications",
    label: "Email Notifications",
    description: "Order updates, delivery windows and receipts.",
  },
  {
    key: "smsNotifications",
    label: "SMS Notifications",
    description: "A text when the courier is close by.",
  },
  {
    key: "marketingEmails",
    label: "Marketing Emails",
    description: "New arrivals, flash sales and size guides.",
  },
  {
    key: "birthdayReminders",
    label: "Kids Birthday Reminders 🎂",
    description: "A nudge a few weeks before the big day.",
  },
] as const;

/** Notification toggles — saved as you flip them. */
export function PreferencesCard() {
  const preferences = useDashboardStore((state) => state.preferences);
  const togglePreference = useDashboardStore((state) => state.togglePreference);

  return (
    <Panel
      title="Preferences"
      description="Choose how Little Luxe keeps in touch."
      icon={<span aria-hidden>🔔</span>}
    >
      <ul className="flex flex-col divide-y divide-glass-border">
        {PREFERENCES.map((preference) => (
          <li
            key={preference.key}
            className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
          >
            <label htmlFor={`pref-${preference.key}`} className="cursor-pointer">
              <span className="block text-sm font-medium text-foreground">{preference.label}</span>
              <span className="block text-xs text-muted-foreground">{preference.description}</span>
            </label>
            <Switch
              id={`pref-${preference.key}`}
              checked={preferences[preference.key]}
              onCheckedChange={() => togglePreference(preference.key)}
            />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Danger zone — deletion is refused in this build (no backend). */
export function DangerZone() {
  const [open, setOpen] = useState(false);

  return (
    <Panel
      tone="danger"
      title="Danger Zone"
      description="Deleting your account removes your orders, addresses and reward points. This can't be undone."
      icon={<AlertTriangle aria-hidden className="size-4" />}
    >
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-12 w-full rounded-full border-rose/40 bg-transparent text-xs font-semibold tracking-[0.16em] text-rose uppercase transition-colors duration-300 hover:bg-rose-soft sm:w-auto sm:px-8"
      >
        Delete Account
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description="Every order, address and reward point goes with it. Type DELETE to confirm."
        confirmPhrase="DELETE"
        confirmLabel="Delete Forever"
        destructive
        onConfirm={() =>
          toast.info("Account deletion is disabled in this demo 🔒", {
            description: "Nothing was removed — connect a backend to enable it.",
          })
        }
      />
    </Panel>
  );
}
