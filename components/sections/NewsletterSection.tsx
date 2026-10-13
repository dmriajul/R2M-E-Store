"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Mail, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/utils";
import { useLanguageStore } from "@/store/useLanguageStore";

/** Transactional routes where the newsletter capture must not compete. */
const NEWSLETTER_HIDDEN_ROUTES = ["/checkout", "/cart"] as const;

/**
 * The single newsletter capture for the storefront. Rendered once from the
 * shop layout, directly above the footer, so every page has exactly one
 * email-capture form — except on checkout/cart routes, where it is hidden.
 * No endpoint yet — submission is simulated, matching the previous
 * homepage behaviour.
 */
export function NewsletterSection() {
  const pathname = usePathname();
  const language = useLanguageStore((state) => state.language);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    // No endpoint yet — the real signup lands with the backend.
    setSubscribed(true);
    setEmail("");
  };

  if (
    pathname &&
    NEWSLETTER_HIDDEN_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
  ) {
    return null;
  }

  const perks = [
    { icon: Truck, label: t("shipping.freeNationwide", language) },
    { icon: ShieldCheck, label: "Authenticity guaranteed" },
    { icon: Sparkles, label: "Concierge support" },
  ] as const;

  return (
    <section aria-label="Newsletter" className="relative py-24 lg:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="glass glow-gold relative overflow-hidden rounded-3xl px-6 py-14 sm:px-12 lg:px-16">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-32 -right-20 size-72 rounded-full bg-primary/12 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-20 size-72 rounded-full bg-cyan/8 blur-3xl"
          />

          <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">
                Newsletter
              </p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                Join the <span className="text-gradient-gold">Inner Circle</span>
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                Private previews, archive access and one considered note a month.
                No noise, ever.
              </p>

              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
                {perks.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-center gap-2 text-xs tracking-wide text-muted-foreground"
                  >
                    <Icon className="size-3.5 text-primary" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={handleSubscribe} className="lg:justify-self-end">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label htmlFor="inner-circle-email" className="sr-only">
                  Email address
                </label>
                <div className="relative flex-1 sm:min-w-72">
                  <Mail
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="inner-circle-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="your@email.com"
                    className="h-12 border-glass-border bg-black/30 pl-11 text-sm backdrop-blur-md transition-colors duration-300 focus-visible:border-primary/60 focus-visible:ring-primary/30"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="group h-12 gap-2 bg-primary px-8 text-sm font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_36px_-6px_rgba(212,175,55,0.9)]"
                >
                  Subscribe
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </div>

              <p
                aria-live="polite"
                className="mt-3 min-h-4 text-xs text-muted-foreground"
              >
                {subscribed
                  ? "You're in. Welcome to the Inner Circle."
                  : "Unsubscribe in one click, any time."}
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
