"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animate, useInView } from "framer-motion";
import { Gem, RotateCcw, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { SectionHeading } from "@/components/sections/SectionHeading";
import { Reveal } from "@/components/sections/Reveal";
import { t } from "@/lib/utils";
import { useLanguageStore } from "@/store/useLanguageStore";

/** Stagger between the four benefit cards: ~70ms, per the animation rules. */
const CARD_STAGGER_S = 0.07;

interface Feature {
  icon: LucideIcon;
  titleKey: string;
  bodyKey: string;
}

/** The Mukra Standard — static brand promises. No data, always rendered. */
const FEATURES: readonly Feature[] = [
  {
    icon: Truck,
    titleKey: "features.freeShipping",
    bodyKey: "features.freeShippingBody",
  },
  {
    icon: RotateCcw,
    titleKey: "features.easyReturns",
    bodyKey: "features.easyReturnsBody",
  },
  {
    icon: ShieldCheck,
    titleKey: "features.secureCheckout",
    bodyKey: "features.secureCheckoutBody",
  },
  {
    icon: Gem,
    titleKey: "features.premiumQuality",
    bodyKey: "features.premiumQualityBody",
  },
] as const;

interface Stat {
  value: number;
  suffix: string;
  labelKey: string;
}

const STATS: readonly Stat[] = [
  { value: 10, suffix: "K+", labelKey: "stats.happyCustomers" },
  { value: 500, suffix: "+", labelKey: "stats.premiumProducts" },
  { value: 50, suffix: "+", labelKey: "stats.countries" },
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
  const language = useLanguageStore((state) => state.language);

  return (
    <div className="group relative flex flex-col items-center px-4 py-6 text-center sm:py-8">
      <span className="text-5xl font-bold tracking-tight tabular-nums sm:text-6xl">
        <span className="text-gradient-gold">
          {value}
          {stat.suffix}
        </span>
      </span>
      <span className="mt-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        {t(stat.labelKey, language)}
      </span>
      <span
        aria-hidden
        className="mt-5 h-px w-10 bg-primary/40 transition-all duration-500 ease-[var(--ease-luxe)] group-hover:w-20 group-hover:bg-primary"
      />
    </div>
  );
}

/**
 * Features + stats — "The Mukra Standard".
 *
 * The storefront's always-rendered trust band: four benefit cards (free
 * shipping, easy returns, secure checkout, premium quality) above the
 * brand stats row (`#stats`, the in-page anchor). None of it is data-driven,
 * so the section keeps its full layout whether the catalogue has 500 products
 * or zero — it is what stops the bottom of the home page from reading as an
 * empty page with stray numbers on it.
 *
 * Layout: 1-up on phones, 2-up on tablets, 4-up from `lg`. The stats row
 * keeps the glass 1/3-split card from the original design and sits inside
 * the same band so the numbers always arrive with their layout around them.
 */
export function FeaturesSection() {
  const reducedMotion = usePrefersReducedMotion();
  const language = useLanguageStore((state) => state.language);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true, amount: 0.35 });

  return (
    <section id="features" aria-labelledby="features-title" className="relative py-24 lg:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            id="features-title"
            eyebrowKey="sections.featuresEyebrow"
            titleKey="sections.features"
            descriptionKey="sections.featuresDescription"
          />
        </Reveal>

        {/* ---------- Benefit cards ---------- */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Reveal
                key={feature.titleKey}
                delay={index * CARD_STAGGER_S}
                className="h-full"
              >
                <div className="glass-soft group relative h-full overflow-hidden rounded-3xl p-6 transition-all duration-500 ease-[var(--ease-luxe)] hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_28px_60px_-26px_rgba(0,0,0,0.95),0_0_34px_-14px_rgba(212,175,55,0.35)] sm:p-7">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -top-20 -right-16 size-44 rounded-full bg-primary/8 blur-3xl transition-opacity duration-500 group-hover:opacity-160"
                  />
                  <span className="relative inline-flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary transition-transform duration-500 ease-[var(--ease-luxe)] group-hover:scale-110">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="relative mt-5 text-base font-semibold tracking-tight text-foreground">
                    {t(feature.titleKey, language)}
                  </h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(feature.bodyKey, language)}
                  </p>
                  <span
                    aria-hidden
                    className="mt-6 block h-px w-10 bg-primary/40 transition-all duration-500 ease-[var(--ease-luxe)] group-hover:w-16 group-hover:bg-primary"
                  />
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* ---------- Stats ---------- */}
        <div
          ref={statsRef}
          id="stats"
          className="glass mt-10 grid grid-cols-1 divide-y divide-glass-border rounded-3xl sm:grid-cols-3 sm:divide-x sm:divide-y-0"
        >
          {STATS.map((stat) => (
            <StatItem
              key={stat.labelKey}
              stat={stat}
              active={statsInView}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>

        {/* Quiet closer — keeps the band from ending on raw numbers. */}
        <Reveal>
          <p className="mt-10 text-center text-xs tracking-[0.22em] text-muted-foreground/80 uppercase">
            <Link
              href="/about"
              className="transition-colors duration-300 hover:text-primary"
            >
              {t("sections.featuresCloser", language)}
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
