"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { loginSchema, type LoginValues } from "@/lib/validations";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

/** Demo credential every mock sign-in expects. */
const DEMO_PASSWORD = "password123";

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
    mode: "onTouched",
  });

  const onSubmit = async (values: LoginValues) => {
    setPending(true);

    // Mock auth: any email works with the demo password.
    await new Promise((resolve) => setTimeout(resolve, 700));

    if (values.password !== DEMO_PASSWORD) {
      setPending(false);
      toast.error("That password does not match", {
        description: `For this demo, use “${DEMO_PASSWORD}”.`,
      });
      return;
    }

    toast.success("Welcome back! 👋", {
      description: `Signed in as ${values.email}`,
    });
    router.push("/shop");
  };

  return (
    <>
      <title>Sign In | LITTLE LUXE</title>
      <meta
        name="description"
        content="Sign in to LITTLE LUXE to track orders, save favourites and check out faster."
      />

      <AuthCard>
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back! 👋</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to track your little one&apos;s orders
          </p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-7 flex flex-col gap-5" noValidate>
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
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.email)}
                className="h-12 rounded-xl border-glass-border bg-[#1A1A1A] pl-10 text-sm transition-colors duration-300 focus-visible:border-primary/60 focus-visible:ring-primary/25 aria-[invalid=true]:border-rose/60"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p role="alert" className="text-xs text-rose">
                {errors.email.message}
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
              autoComplete="current-password"
              placeholder="••••••••"
              invalid={Boolean(errors.password)}
              {...register("password")}
            />
            {errors.password && (
              <p role="alert" className="text-xs text-rose">
                {errors.password.message}
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
            disabled={pending || isSubmitting}
            className="h-13 w-full gap-2 rounded-full bg-primary text-sm font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:scale-[1.01]"
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

          <p className="text-center text-[11px] text-muted-foreground">
            Demo tip: any email with <span className="text-primary">{DEMO_PASSWORD}</span>
          </p>
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
          New to Little Luxe?{" "}
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
