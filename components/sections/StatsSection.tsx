"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import { ArrowRight, Mail, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

interface Stat {
  value: number;
  suffix: string;
  label: string;
}

const STATS: readonly Stat[] = [
  { value: 10, suffix: "K+", label: "Happy Customers" },
  { value: 500, suffix: "+", label: "Premium Products" },
  { value: 50, suffix: "+", label: "Countries" },
] as const;

const PERKS = [
  { icon: Truck, label: "Free worldwide shipping" },
  { icon: ShieldCheck, label: "Authenticity guaranteed" },
  { icon: Sparkles, label: "Concierge support" },
] as const;

/** Counts from 0 to `to` once the section enters the viewport. */
function useCountUp(to: number, active: boolean, reducedMotion: boolean): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (reducedMotion) {
      setValue(to);
      return;
    }

    const controls = animate(0, to, {
      duration: 2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setValue(Math.round(latest)),
    });

    return () => controls.stop();
  }, [active, to, reducedMotion]);

  return value;
}

function StatItem({
  stat,
  active,
  reducedMotion,
}: {
  stat: Stat;
  active: boolean;
  reducedMotion: boolean;
}) {
  const value = useCountUp(stat.value, active, reducedMotion);

  return (
    <div className="group relative flex flex-col items-center px-4 py-6 text-center sm:py-8">
      <span className="text-5xl font-bold tracking-tight tabular-nums sm:text-6xl">
        <span className="text-gradient-gold">
          {value}
          {stat.suffix}
        </span>
      </span>
      <span className="mt-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        {stat.label}
      </span>
      <span
        aria-hidden
        className="mt-5 h-px w-10 bg-primary/40 transition-all duration-500 ease-[var(--ease-luxe)] group-hover:w-20 group-hover:bg-primary"
      />
    </div>
  );
}

export function StatsSection() {
  const reducedMotion = usePrefersReducedMotion();
  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true, amount: 0.35 });
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    // No endpoint yet — the real signup lands with the backend.
    setSubscribed(true);
    setEmail("");
  };

  return (
    <section id="stats" className="relative py-24 lg:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ---------- Stats ---------- */}
        <div
          ref={statsRef}
          className="glass grid grid-cols-1 divide-y divide-glass-border rounded-3xl sm:grid-cols-3 sm:divide-x sm:divide-y-0"
        >
          {STATS.map((stat) => (
            <StatItem
              key={stat.label}
              stat={stat}
              active={statsInView}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>

        {/* ---------- Newsletter ---------- */}
        <div className="glass glow-gold relative mt-8 overflow-hidden rounded-3xl px-6 py-14 sm:px-12 lg:px-16">
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
                {PERKS.map(({ icon: Icon, label }) => (
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
