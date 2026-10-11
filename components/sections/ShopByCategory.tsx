"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { cn, t, translateCategory } from "@/lib/utils";
import { categoryToSlug, type CategoryFilter } from "@/lib/site";
import { useLanguageStore } from "@/store/useLanguageStore";

const EASE_LUXE = [0.22, 1, 0.36, 1] as const;

/** One "Shop by Category" card: where it links, its photo and live count. */
export interface ShopCategoryCard {
  /** Category or category group, as understood by the shop filter. */
  filter: CategoryFilter;
  /** Local photo under /public. */
  image: string;
  /** Shown over the gradient if the photo fails to load. */
  emoji: string;
  /** Active products the shop lists for this filter. */
  count: number;
}

/** Fallback wash per card slot (also tints the bottom of every photo). */
const CARD_STYLES: readonly { gradient: string; glow: string }[] = [
  {
    gradient:
      "linear-gradient(160deg, rgba(212,175,55,0.42) 0%, rgba(212,175,55,0.10) 42%, rgba(10,10,10,0.92) 100%)",
    glow: "rgba(212,175,55,0.35)",
  },
  {
    gradient:
      "linear-gradient(160deg, rgba(0,240,255,0.34) 0%, rgba(0,240,255,0.08) 42%, rgba(10,10,10,0.92) 100%)",
    glow: "rgba(0,240,255,0.28)",
  },
  {
    gradient:
      "linear-gradient(160deg, rgba(255,122,162,0.32) 0%, rgba(138,111,31,0.16) 45%, rgba(10,10,10,0.92) 100%)",
    glow: "rgba(255,122,162,0.26)",
  },
] as const;

const gridVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

function buildCardVariants(reducedMotion: boolean): Variants {
  return {
    hidden: { opacity: 0, y: reducedMotion ? 0 : 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reducedMotion ? 0.5 : 0.8, ease: EASE_LUXE },
    },
  };
}

/** Photo with a graceful gradient + emoji fallback if it cannot load. */
function CategoryArtwork({
  src,
  emoji,
  gradient,
}: {
  src: string;
  emoji: string;
  gradient: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{ backgroundImage: gradient }}
    >
      {failed ? (
        <span className="absolute inset-0 grid place-items-center pb-16 text-7xl drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:scale-110">
          {emoji}
        </span>
      ) : (
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 1024px) 20vw, (min-width: 768px) 33vw, (min-width: 640px) 45vw, 72vw"
          className="object-cover transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:scale-105"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

interface ShopByCategoryProps {
  /** Cards in display order; each links to `/shop?category=<slug>`. */
  cards: readonly ShopCategoryCard[];
}

export function ShopByCategory({ cards }: ShopByCategoryProps) {
  const language = useLanguageStore((state) => state.language);
  const reducedMotion = usePrefersReducedMotion();
  const variants = buildCardVariants(reducedMotion);
  const numberFormat = new Intl.NumberFormat(
    language === "bn" ? "bn-BD" : "en-US",
  );

  if (cards.length === 0) return null;

  return (
    <section id="collections" className="relative py-24 lg:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">
            {t("common.catalogue", language)}
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            {t("sections.collections", language)}
          </h2>
          <span
            aria-hidden
            className="mt-5 block h-px w-24 bg-gradient-to-r from-primary via-primary/50 to-transparent"
          />
        </div>

        {/* Mobile: swipeable snap row. md: 3 + 2 centred. lg: one row of 5. */}
        <motion.ul
          variants={gridVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="-mx-4 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pt-2 pb-6 [scrollbar-width:none] md:mx-0 md:mt-14 md:grid md:grid-cols-6 md:gap-6 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden"
        >
          {cards.map(({ filter, image, emoji, count }, index) => {
            const style = CARD_STYLES[index % CARD_STYLES.length]!;
            const label = translateCategory(filter, language);
            const countLabel =
              count === 1 && language !== "bn"
                ? "piece"
                : t("common.pieces", language);

            return (
              <motion.li
                key={filter}
                variants={variants}
                className={cn(
                  "w-[72%] shrink-0 snap-start sm:w-[45%] md:col-span-2 md:w-auto lg:col-span-1",
                  // Centre the second row (cards 4–5) of the md 3 + 2 layout.
                  index === 3 && "md:col-start-2 lg:col-start-auto",
                )}
              >
                <Link
                  href={`/shop?category=${categoryToSlug(filter)}`}
                  aria-label={
                    count > 0
                      ? `${label} — ${numberFormat.format(count)} ${countLabel}`
                      : label
                  }
                  className="group relative block aspect-3/4 overflow-hidden rounded-3xl border border-glass-border bg-black transition-all duration-500 ease-[var(--ease-luxe)] hover:-translate-y-2 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <CategoryArtwork
                    src={image}
                    emoji={emoji}
                    gradient={style.gradient}
                  />

                  {/* Legibility scrim behind the title. */}
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent"
                  />

                  {/* Brightening wash on hover. */}
                  <span
                    aria-hidden
                    className="absolute inset-0 opacity-0 transition-opacity duration-500 ease-[var(--ease-luxe)] group-hover:opacity-100"
                    style={{
                      backgroundImage: `radial-gradient(120% 80% at 50% 110%, ${style.glow} 0%, transparent 70%)`,
                    }}
                  />

                  {count > 0 && (
                    <Badge
                      variant="outline"
                      className="absolute top-4 right-4 border-glass-border bg-black/50 text-[10px] tracking-[0.16em] text-white/85 uppercase backdrop-blur-md"
                    >
                      {numberFormat.format(count)} {countLabel}
                    </Badge>
                  )}

                  {/* Name + CTA */}
                  <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5">
                    <h3 className="text-xl leading-tight font-bold tracking-tight text-balance text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.75)] sm:text-2xl lg:text-xl xl:text-2xl">
                      {label}
                    </h3>
                    <span className="flex translate-y-2 items-center gap-2 text-xs font-semibold tracking-[0.18em] text-primary uppercase opacity-0 transition-all duration-500 ease-[var(--ease-luxe)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 motion-reduce:opacity-100 pointer-coarse:translate-y-0 pointer-coarse:opacity-100">
                      {t("common.explore", language)}
                      <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>
      </div>
    </section>
  );
}
