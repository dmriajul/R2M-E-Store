"use client";

import { useState } from "react";
import Link from "next/link";
import { TurnstileCaptcha } from "@/components/TurnstileCaptcha";
import { useTurnstile } from "@/hooks/useTurnstile";
import { authErrorMessage, isAuthErrorCode, type AuthErrorCode } from "@/lib/auth-messages";
import { AuthFeedback } from "@/components/auth/AuthFeedback";
import { useAuthFeedback } from "@/hooks/useAuthFeedback";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, Phone, Sparkles, User } from "lucide-react";
import { queueAuthSuccess } from "@/lib/auth-flash";
import { registerSchema, type RegisterValues } from "@/lib/validations";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const FIELD_CLASS =
  "h-12 rounded-xl border-glass-border bg-[#1A1A1A] pl-10 text-sm transition-colors duration-300 focus-visible:border-primary/60 focus-visible:ring-primary/25 aria-[invalid=true]:border-rose/60";

export default function RegisterPage() {
  const captcha = useTurnstile();
  const feedback = useAuthFeedback();
  const [pending, setPending] = useState(false);
  const [captchaAttempted, setCaptchaAttempted] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors, isValid, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      acceptedTerms: false,
    },
    mode: "all",
  });

  const password = watch("password");

  const onSubmit = async (values: RegisterValues) => {
    if (!captcha.token) { setCaptchaAttempted(true); return; }
    feedback.clear();
    const turnstileToken = captcha.token;
    captcha.clearToken();
    setPending(true);

    try {
      /* Create the durable account and token; never create a session implicitly. */
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.fullName,
          email: values.email,
          phone: values.phone || undefined,
          password: values.password,
          confirmPassword: values.confirmPassword,
          acceptedTerms: values.acceptedTerms,
          turnstileToken,
        }),
      });

      const payload: { code?: unknown; fieldErrors?: Record<string, unknown> } = await response.json();

      if (!response.ok) {
        const code: AuthErrorCode = isAuthErrorCode(payload.code) ? payload.code : "SERVER_ERROR";
        const fields = { name: "fullName", email: "email", phone: "phone", password: "password", confirmPassword: "confirmPassword", acceptedTerms: "acceptedTerms" } as const;
        let focus = true;
        for (const [apiField, formField] of Object.entries(fields)) {
          const fieldCode = payload.fieldErrors?.[apiField];
          if (isAuthErrorCode(fieldCode)) {
            setError(formField, { type: "server", message: authErrorMessage(fieldCode) }, { shouldFocus: focus });
            focus = false;
          }
        }
        feedback.show(code);
        return;
      }

      queueAuthSuccess("ACCOUNT_CREATED");
      // Customer sign-in requires verification. Existing checkout permissions are unchanged.
      window.location.assign("/auth/verify-email-pending");
    } catch {
      feedback.show("SERVER_ERROR");
    } finally {
      captcha.reset();
      setPending(false);
    }
  };

  return (
    <>
      <title>Create Account | MUKRA</title>
      <meta
        name="description"
        content="Join MUKRA for early access to new kids fashion drops, size help and order tracking."
      />

      <AuthCard>
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Create Account ✨</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Join the Mukra family
          </p>
        </header>

        <form onChangeCapture={() => {
          feedback.clear();
          for (const field of Object.keys(errors) as (keyof RegisterValues)[]) {
            if (errors[field]?.type === "server") clearErrors(field);
          }
        }} onKeyDownCapture={(event) => {
          // A disabled submit button can suppress the browser's implicit Enter submission.
          if (event.key === "Enter" && event.target instanceof HTMLInputElement && !captcha.token && !pending) {
            setCaptchaAttempted(true);
          }
        }} onSubmitCapture={() => {
          // Also guide keyboard/programmatic submissions when other fields are invalid.
          if (!captcha.token && !pending) setCaptchaAttempted(true);
        }} onSubmit={handleSubmit(onSubmit)} className="mt-7 flex flex-col gap-5" noValidate>
          <AuthFeedback message={feedback.message} warning={feedback.warning} onDismiss={feedback.clear} />
          {/* Full name */}
          <div className="flex flex-col gap-2">
            <label htmlFor="register-name" className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Full Name
            </label>
            <div className="relative">
              <User aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="register-name"
                aria-describedby={errors.fullName ? "register-name-error" : undefined}
                autoComplete="name"
                placeholder="Alex Parker"
                aria-invalid={Boolean(errors.fullName)}
                className={FIELD_CLASS}
                {...register("fullName")}
              />
            </div>
            {errors.fullName && (
              <p id="register-name-error" role="alert" className="text-xs text-rose">
                {errors.fullName.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-2">
            <label htmlFor="register-email" className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Email
            </label>
            <div className="relative">
              <Mail aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="register-email"
                aria-describedby={errors.email ? "register-email-error" : undefined}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.email)}
                className={FIELD_CLASS}
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p id="register-email-error" role="alert" className="text-xs text-rose">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-2">
            <label htmlFor="register-phone" className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Phone <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <div className="relative">
              <Phone aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="register-phone"
                aria-describedby={errors.phone ? "register-phone-error" : undefined}
                type="tel"
                autoComplete="tel"
                placeholder="+880 1700 000000"
                aria-invalid={Boolean(errors.phone)}
                className={FIELD_CLASS}
                {...register("phone")}
              />
            </div>
            {errors.phone && (
              <p id="register-phone-error" role="alert" className="text-xs text-rose">
                {errors.phone.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <label htmlFor="register-password" className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Password
            </label>
            <PasswordInput
              id="register-password"
              aria-describedby={errors.password ? "register-password-error" : undefined}
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={Boolean(errors.password)}
              {...register("password")}
            />
            <PasswordStrength value={password ?? ""} className="mt-1" />
            {errors.password && (
              <p id="register-password-error" role="alert" className="text-xs text-rose">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div className="flex flex-col gap-2">
            <label htmlFor="register-confirm" className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Confirm Password
            </label>
            <PasswordInput
              id="register-confirm"
              aria-describedby={errors.confirmPassword ? "register-confirm-error" : undefined}
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={Boolean(errors.confirmPassword)}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p id="register-confirm-error" role="alert" className="text-xs text-rose">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Terms */}
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-glass-border bg-[#1A1A1A] accent-[var(--primary)]"
                {...register("acceptedTerms")}
              />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
                  Terms
                </Link>{" "}
                &amp;{" "}
                <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
                  Privacy Policy
                </Link>
              </span>
            </label>
            {errors.acceptedTerms && (
              <p role="alert" className="text-xs text-rose">
                {errors.acceptedTerms.message}
              </p>
            )}
          </div>

          {/* Keep the visible captcha area immediately above the submit button. */}
          <section aria-label="Captcha verification" className="flex flex-col gap-2">
            <TurnstileCaptcha
              key={captcha.generation}
              action="register"
              onVerify={(token) => {
                captcha.onVerify(token);
                if (token.trim()) setCaptchaAttempted(false);
              }}
              onError={captcha.onError}
            />
            <p
              id="register-captcha-guidance"
              role={captchaAttempted && !captcha.token && !pending ? "alert" : "status"}
              className={`text-xs leading-5 ${captchaAttempted && !captcha.token && !pending ? "text-rose" : captcha.token ? "text-emerald-400" : "text-amber-200"}`}
            >
              {pending ? "Creating your account…" : captcha.token
                ? "Captcha verified. Complete all required fields to create your account."
                : captchaAttempted ? "Please complete the captcha verification."
                  : "Captcha verification is required. Complete the security check above to enable Create Account."}
            </p>
          </section>

          <Button
            type="submit"
            disabled={pending || isSubmitting || !isValid || !captcha.token}
            aria-busy={pending || isSubmitting}
            aria-describedby="register-captcha-guidance"
            className="h-13 w-full gap-2 rounded-full bg-primary text-sm font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:scale-[1.01]"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Create Account
              </>
            )}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <Separator className="flex-1 bg-glass-border" />
          <span className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
            or continue with
          </span>
          <Separator className="flex-1 bg-glass-border" />
        </div>

        <SocialButtons />

        <p className="mt-7 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 transition-colors duration-300 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Sign In
          </Link>
        </p>
      </AuthCard>
    </>
  );
}
