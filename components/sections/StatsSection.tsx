"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
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

/**
 * Progressive-enhancement count-up. The final value is the initial state, so
 * it is server-rendered into the HTML (and shown with JS disabled or before
 * hydration). Once the section scrolls into view, the count-up replays from
 * 0 as an enhancement only — and never for reduced-motion visitors, who keep
 * the final value throughout.
 */
function useCountUp(to: number, active: boolean, reducedMotion: boolean): number {
  const [value, setValue] = useState(to);

  useEffect(() => {
    if (!active || reducedMotion) return;

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
      </div>
    </section>
  );
}
