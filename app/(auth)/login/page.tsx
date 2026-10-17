"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import {
  AUTH_ERROR_CODES,
  getLoginErrorMessage,
  loginSchema,
  type AuthErrorCopy,
  type LoginValues,
} from "@/lib/validations/auth";
import { clearIdentityCaches } from "@/lib/session-cache";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { Toast, authToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<AuthErrorCopy | null>(null);
  const activeToastId = useRef<string | number | undefined>(undefined);
  /* Set by `clearSessionCache()` — confirms the debug wipe actually ran. */
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("cleared") === "1") {
      setCacheCleared(true);
      authToast.info(
        "Session and caches cleared",
        "Cookies, localStorage and cached data have been removed for this site.",
      );
    }
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
    mode: "all",
  });

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

  const onSubmit = async (values: LoginValues) => {
    setPending(true);
    dismissServerError();

    /* Where to land after a successful sign-in (middleware adds ?callbackUrl=). */
    const callbackUrl =
      new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get(
        "callbackUrl",
      ) ?? "/dashboard";

    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (!result || result.error) {
        setPending(false);

        const rawCode = !result
          ? AUTH_ERROR_CODES.SERVER_ERROR
          : result.code
            ? result.code
            : result.error === "CredentialsSignin"
              ? AUTH_ERROR_CODES.INVALID_CREDENTIALS
              : AUTH_ERROR_CODES.SERVER_ERROR;

        const copy = getLoginErrorMessage(rawCode);
        setServerError(copy);

        activeToastId.current =
          copy.severity === "warning"
            ? authToast.warning(copy.title, copy.message)
            : authToast.error(copy.title, copy.message);
        return;
      }

      /* Drop whatever the previous identity left cached *before* the next page
         loads — so an admin never opens the console on a shopper's data, and a
         shopper never inherits an operator's session data. */
      clearIdentityCaches();

      authToast.success("Welcome back! 👋", `Signed in as ${values.email}`);

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setPending(false);
      const copy = getLoginErrorMessage(AUTH_ERROR_CODES.SERVER_ERROR);
      setServerError(copy);
      activeToastId.current = authToast.error(copy.title, copy.message);
    }
  };

  const emailInlineError =
    errors.email?.message ??
    (serverError?.field === "email" ? serverError.message : undefined);

  const passwordInlineError =
    errors.password?.message ??
    (serverError?.code === AUTH_ERROR_CODES.INVALID_CREDENTIALS
      ? serverError.message
      : undefined);

  return (
    <>
      <title>Sign In | MUKRA</title>
      <meta
        name="description"
        content="Sign in to MUKRA to track orders, save favourites and check out faster."
      />

      <AuthCard>
        {cacheCleared && (
          <p
            role="status"
            className="mb-6 flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200"
          >
            <ShieldCheck aria-hidden className="mt-px size-4 shrink-0" />
            <span>
              <strong className="font-semibold">Session cleared.</strong> Cookies, localStorage,
              sessionStorage and cached data were removed. Sign in again to start a clean session.
            </span>
          </p>
        )}

        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back! 👋</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to track your little one&apos;s orders
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

          {/* Email */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="login-email"
              className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
            >
              Email
            </label>
            <div className="relative">
              <Mail
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="login-email"
                aria-describedby={emailInlineError ? "login-email-error" : undefined}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(emailInlineError)}
                className="h-12 rounded-xl border-glass-border bg-[#1A1A1A] pl-10 text-sm transition-colors duration-300 focus-visible:border-primary/60 focus-visible:ring-primary/25 aria-[invalid=true]:border-rose/60"
                {...register("email")}
              />
            </div>
            {emailInlineError && (
              <p
                id="login-email-error"
                role="alert"
                className={
                  serverError?.field === "email" && serverError.severity === "warning"
                    ? "text-xs text-amber-400"
                    : "text-xs text-rose"
                }
              >
                {emailInlineError}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="login-password"
                className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-lavender underline-offset-4 transition-colors duration-300 hover:text-rose hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Forgot Password?
              </Link>
            </div>
            <PasswordInput
              id="login-password"
              aria-describedby={passwordInlineError ? "login-password-error" : undefined}
              autoComplete="current-password"
              placeholder="••••••••"
              invalid={Boolean(passwordInlineError)}
              {...register("password")}
            />
            {passwordInlineError && (
              <p id="login-password-error" role="alert" className="text-xs text-rose">
                {passwordInlineError}
              </p>
            )}
          </div>

          {/* Remember me */}
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 shrink-0 cursor-pointer rounded border-glass-border bg-[#1A1A1A] accent-[var(--primary)]"
              {...register("remember")}
            />
            Keep me signed in on this device
          </label>

          <Button
            type="submit"
            disabled={pending || isSubmitting || !isValid}
            className="h-13 w-full gap-2 rounded-full bg-primary text-sm font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 motion-safe:hover:scale-[1.01]"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-4">
          <Separator className="flex-1 bg-glass-border" />
          <span className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
            or continue with
          </span>
          <Separator className="flex-1 bg-glass-border" />
        </div>

        <SocialButtons />

        <p className="mt-7 text-center text-sm text-muted-foreground">
          New to Mukra?{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 transition-colors duration-300 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Create Account
          </Link>
        </p>
      </AuthCard>
    </>
  );
}
