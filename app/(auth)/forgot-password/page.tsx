"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, Loader2, Mail, MailCheck } from "lucide-react";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/lib/validations";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    setPending(true);
    // Mock: a real implementation would POST to /api/auth/forgot-password.
    await new Promise((resolve) => setTimeout(resolve, 700));
    setPending(false);
    setSentTo(values.email);
  };

  return (
    <>
      <title>Reset Password | LITTLE LUXE</title>
      <meta
        name="description"
        content="Reset your LITTLE LUXE password — we'll email you a secure link."
      />

      <AuthCard>
        <header className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full border border-glass-border bg-primary/10 text-2xl">
            <KeyRound className="size-6 text-primary" aria-hidden />
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight">
            Forgot Password? 🔑
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No worries! Enter your email and we&apos;ll send a reset link
          </p>
        </header>

        {sentTo ? (
          /* ---------- Success state ---------- */
          <div className="mt-7 flex flex-col items-center gap-4 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-emerald-500/12 text-emerald-400">
              <MailCheck className="size-6" aria-hidden />
            </span>
            <h2 className="text-lg font-semibold">Check your inbox! 📧</h2>
            <p className="max-w-xs text-sm text-muted-foreground">
              We sent a reset link to{" "}
              <span className="font-medium text-foreground">{sentTo}</span>. It
              expires in 30 minutes.
            </p>

            <Button
              type="button"
              variant="outline"
              onClick={() => setSentTo(null)}
              className="mt-2 h-11 rounded-full border-glass-border bg-glass px-6 text-xs font-semibold tracking-[0.14em] uppercase transition-colors duration-300 hover:border-primary/50 hover:text-primary"
            >
              Use a different email
            </Button>
          </div>
        ) : (
          /* ---------- Request form ---------- */
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mt-7 flex flex-col gap-5"
            noValidate
          >
            <div className="flex flex-col gap-2">
              <label
                htmlFor="forgot-email"
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
                  id="forgot-email"
                  aria-describedby={errors.email ? "forgot-email-error" : undefined}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(errors.email)}
                  className="h-12 rounded-xl border-glass-border bg-[#1A1A1A] pl-10 text-sm transition-colors duration-300 focus-visible:border-primary/60 focus-visible:ring-primary/25 aria-[invalid=true]:border-rose/60"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p id="forgot-email-error" role="alert" className="text-xs text-rose">
                  {errors.email.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={pending}
              className="h-13 w-full gap-2 rounded-full bg-primary text-sm font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:scale-[1.01]"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </form>
        )}

        <p className="mt-7 text-center text-sm">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-muted-foreground transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ArrowLeft className="size-3.5" />
            Back to Login
          </Link>
        </p>
      </AuthCard>
    </>
  );
}
