"use client";

import { useState, useTransition, type FormEvent } from "react";
import { resendVerificationEmail } from "@/app/(auth)/auth/actions";
import { TurnstileCaptcha } from "@/components/TurnstileCaptcha";
import { CaptchaBypassNotice } from "@/components/auth/CaptchaBypassNotice";
import { useTurnstile } from "@/hooks/useTurnstile";
import { isTurnstileBypassed, TURNSTILE_ERROR, TURNSTILE_RESPONSE_FIELD } from "@/lib/turnstile-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResendVerificationForm() {
  const captcha = useTurnstile();
  /* `next dev` only — production and test builds keep the real challenge. */
  const captchaBypassed = isTurnstileBypassed();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const consumed = captcha.consumeToken();
    if (!consumed && !captchaBypassed) { setMessage(TURNSTILE_ERROR); return; }
    const turnstileToken = consumed || undefined;
    setMessage("");
    startTransition(async () => {
      try {
        const result = await resendVerificationEmail({
          email,
          [TURNSTILE_RESPONSE_FIELD]: turnstileToken,
          turnstileToken,
        });
        setMessage(result.message);
      } catch {
        setMessage("We couldn't reach the verification service. Please try again.");
      } finally {
        captcha.reset();
      }
    });
  }
  return (
    <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-3 text-left">
      <label
        htmlFor="resend-email"
        className="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
      >
        Registration email
      </label>
      <Input
        id="resend-email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="h-12 rounded-xl border-glass-border bg-[#1A1A1A]"
      />
      {captchaBypassed ? (
        <CaptchaBypassNotice />
      ) : (
        <TurnstileCaptcha key={captcha.generation} action="resend_verification" onVerify={captcha.onVerify} onError={captcha.onError} />
      )}
      <Button type="submit" disabled={pending || (!captchaBypassed && !captcha.token)} className="h-12 rounded-full">
        {pending ? "Requesting link…" : "Resend Email"}
      </Button>
      <p className="text-xs leading-6 text-muted-foreground">
        Up to three resends per hour. Only your newest link will work.
      </p>
      {message && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm leading-6"
        >
          {message}
        </p>
      )}
    </form>
  );
}
