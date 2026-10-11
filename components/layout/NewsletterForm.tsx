"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check } from "lucide-react";
import { TurnstileCaptcha } from "@/components/TurnstileCaptcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Client-only newsletter capture. No endpoint yet — submission is simulated
 * so the shell is interactive without a database.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const isCaptchaEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    if (isCaptchaEnabled && !captchaToken) return;
    setSubmitted(true);
    setEmail("");
    setCaptchaToken("");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <div className="flex items-center gap-2 rounded-full border border-glass-border bg-glass p-1 pl-4 backdrop-blur-md transition-colors duration-300 focus-within:border-primary/60 focus-within:shadow-[0_0_28px_-10px_rgba(212,175,55,0.8)]">
        <Input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="your@email.com"
          className="h-9 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Subscribe to the newsletter"
          disabled={isCaptchaEnabled && !captchaToken}
          className="size-9 shrink-0 rounded-full transition-transform duration-300 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitted ? (
            <Check className="size-4" />
          ) : (
            <ArrowRight className="size-4" />
          )}
        </Button>
      </div>
      {isCaptchaEnabled && (
        <div className="mt-3">
          <TurnstileCaptcha
            onVerify={setCaptchaToken}
            onError={() => setCaptchaToken("")}
            theme="dark"
          />
        </div>
      )}
      <p
        aria-live="polite"
        className="mt-3 h-4 text-xs text-muted-foreground transition-opacity duration-300"
      >
        {submitted
          ? "Welcome to the list — expect only the rare, considered note."
          : "Private previews. No noise, ever."}
      </p>
    </form>
  );
}
