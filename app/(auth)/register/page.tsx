"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, Phone, Sparkles, User } from "lucide-react";
import {
  AUTH_ERROR_CODES,
  getRegisterErrorMessage,
  registerSchema,
  type AuthErrorCopy,
  type RegisterValues,
} from "@/lib/validations/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { Toast, authToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const FIELD_CLASS =
  "h-12 rounded-xl border-glass-border bg-[#1A1A1A] pl-10 text-sm transition-colors duration-300 focus-visible:border-primary/60 focus-visible:ring-primary/25 aria-[invalid=true]:border-rose/60";

export default function RegisterPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<AuthErrorCopy | null>(null);
  const activeToastId = useRef<string | number | undefined>(undefined);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors, isSubmitting, isValid, touchedFields },
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
  const confirmPassword = watch("confirmPassword");

  // Re-validate confirmPassword whenever password changes so mismatch updates immediately.
  useEffect(() => {
    if (confirmPassword || touchedFields.confirmPassword) {
      void trigger("confirmPassword");
    }
  }, [password, confirmPassword, touchedFields.confirmPassword, trigger]);

  // Clear visible server errors as soon as the user starts fixing the inputs.
  useEffect(() => {
    const subscription = watch(() => {
      setServerError((current) => {
        if (current && activeToastId.current !== undefined) {
          authToast.dismiss(activeToastId.current);
          activeToastId.current = undefined;
        }
        return null;
      });
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const dismissServerError = () => {
    setServerError(null);
    if (activeToastId.current !== undefined) {
      authToast.dismiss(activeToastId.current);
      activeToastId.current = undefined;
    }
  };

  const onSubmit = async (values: RegisterValues) => {
    setPending(true);
    dismissServerError();

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.fullName,
          email: values.email,
          phone: values.phone || undefined,
          password: values.password,
          confirmPassword: values.confirmPassword,
        }),
      });

      const payload = (await response.json()) as {
        data?: unknown;
        error?: string | null;
        code?: string | null;
        field?: string;
      };

      if (!response.ok) {
        setPending(false);
        const copy = getRegisterErrorMessage(payload.code ?? payload.error);
        setServerError(copy);
        activeToastId.current =
          copy.severity === "warning"
            ? authToast.warning(copy.title, copy.message)
            : authToast.error(copy.title, copy.message);
        return;
      }

      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      }).catch(() => null);

      const firstName = values.fullName.trim().split(" ")[0] || "there";

      if (!result || result.error) {
        setPending(false);
        authToast.success(
          "Account created! Verification email sent.",
          "Your account is ready. Please sign in with your email and password.",
        );
        router.push("/login");
        return;
      }

      authToast.success(
        "Account created! Verification email sent.",
        `Welcome to the family, ${firstName}. A verification email has been sent to ${values.email}.`,
      );
      router.push("/dashboard");
      router.refresh();
    } catch {
      setPending(false);
      const copy = getRegisterErrorMessage(AUTH_ERROR_CODES.SERVER_ERROR);
      setServerError(copy);
      activeToastId.current = authToast.error(copy.title, copy.message);
    }
  };

  const fullNameError =
    errors.fullName?.message ??
    (serverError?.field === "fullName" ? serverError.message : undefined);
  const emailError =
    errors.email?.message ??
    (serverError?.field === "email" ? serverError.message : undefined);
  const phoneError =
    errors.phone?.message ??
    (serverError?.field === "phone" ? serverError.message : undefined);
  const passwordError =
    errors.password?.message ??
    (serverError?.field === "password" ? serverError.message : undefined);
  const confirmPasswordError =
    errors.confirmPassword?.message ??
    (serverError?.field === "confirmPassword" ? serverError.message : undefined);

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

        <form onSubmit={handleSubmit(onSubmit)} className="mt-7 flex flex-col gap-5" noValidate>
          {serverError && (
            <Toast
              variant={serverError.severity}
              title={serverError.title}
              message={serverError.message}
              onDismiss={dismissServerError}
            />
          )}

          {/* Full name */}
          <div className="flex flex-col gap-2">
            <label htmlFor="register-name" className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Full Name
            </label>
            <div className="relative">
              <User aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="register-name"
                aria-describedby={fullNameError ? "register-name-error" : undefined}
                autoComplete="name"
                placeholder="Alex Parker"
                aria-invalid={Boolean(fullNameError)}
                className={FIELD_CLASS}
                {...register("fullName")}
              />
            </div>
            {fullNameError && (
              <p id="register-name-error" role="alert" className="text-xs text-rose">
                {fullNameError}
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
                aria-describedby={emailError ? "register-email-error" : undefined}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(emailError)}
                className={FIELD_CLASS}
                {...register("email")}
              />
            </div>
            {emailError && (
              <p id="register-email-error" role="alert" className="text-xs text-rose">
                {emailError}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-2">
            <label htmlFor="register-phone" className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Phone
            </label>
            <div className="relative">
              <Phone aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="register-phone"
                aria-describedby={phoneError ? "register-phone-error" : undefined}
                type="tel"
                autoComplete="tel"
                placeholder="+880 1700 000000"
                aria-invalid={Boolean(phoneError)}
                className={FIELD_CLASS}
                {...register("phone")}
              />
            </div>
            {phoneError && (
              <p id="register-phone-error" role="alert" className="text-xs text-rose">
                {phoneError}
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
              aria-describedby={passwordError ? "register-password-error" : undefined}
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={Boolean(passwordError)}
              {...register("password")}
            />
            <PasswordStrength value={password ?? ""} className="mt-1" />
            {passwordError && (
              <p id="register-password-error" role="alert" className="text-xs text-rose">
                {passwordError}
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
              aria-describedby={confirmPasswordError ? "register-confirm-error" : undefined}
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={Boolean(confirmPasswordError)}
              {...register("confirmPassword")}
            />
            {confirmPasswordError && (
              <p id="register-confirm-error" role="alert" className="text-xs text-rose">
                {confirmPasswordError}
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

          <Button
            type="submit"
            disabled={pending || isSubmitting || !isValid}
            className="h-13 w-full gap-2 rounded-full bg-primary text-sm font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 motion-safe:hover:scale-[1.01]"
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
