"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

const EASE_LUXE = [0.22, 1, 0.36, 1] as const;

interface Collection {
  slug: string;
  name: string;
  itemCount: number;
  /** Distinct hue per card, built from pure CSS gradients. */
  gradient: string;
  glow: string;
}

const COLLECTIONS: readonly Collection[] = [
  {
    slug: "watches",
    name: "Watches",
    itemCount: 48,
    gradient:
      "linear-gradient(160deg, rgba(212,175,55,0.42) 0%, rgba(212,175,55,0.10) 42%, rgba(10,10,10,0.92) 100%)",
    glow: "rgba(212,175,55,0.35)",
  },
  {
    slug: "jewelry",
    name: "Jewelry",
    itemCount: 126,
    gradient:
      "linear-gradient(160deg, rgba(0,240,255,0.34) 0%, rgba(0,240,255,0.08) 42%, rgba(10,10,10,0.92) 100%)",
    glow: "rgba(0,240,255,0.28)",
  },
  {
    slug: "accessories",
    name: "Accessories",
    itemCount: 74,
    gradient:
      "linear-gradient(160deg, rgba(255,122,162,0.32) 0%, rgba(138,111,31,0.16) 45%, rgba(10,10,10,0.92) 100%)",
    glow: "rgba(255,122,162,0.26)",
  },
] as const;

const gridVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14 } },
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

export function CollectionsGrid() {
  const reducedMotion = usePrefersReducedMotion();
  const variants = buildCardVariants(reducedMotion);

  return (
    <section id="collections" className="relative py-24 lg:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">
            Catalogue
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Shop by Category
          </h2>
          <span
            aria-hidden
            className="mt-5 block h-px w-24 bg-gradient-to-r from-primary via-primary/50 to-transparent"
          />
        </div>

        <motion.div
          variants={gridVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-14 grid gap-6 md:grid-cols-3"
        >
          {COLLECTIONS.map((collection) => (
            <motion.div key={collection.slug} variants={variants}>
              <Link
                href={`/shop?category=${collection.slug}`}
                className="group relative block aspect-3/4 overflow-hidden rounded-3xl border border-glass-border transition-all duration-500 ease-[var(--ease-luxe)] hover:-translate-y-2 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                style={{ backgroundImage: collection.gradient }}
              >
                {/* Brightening wash on hover. */}
                <span
                  aria-hidden
                  className="absolute inset-0 opacity-0 transition-opacity duration-500 ease-[var(--ease-luxe)] group-hover:opacity-100"
                  style={{
                    backgroundImage: `radial-gradient(120% 80% at 50% 110%, ${collection.glow} 0%, transparent 70%)`,
                  }}
                />

                {/* Item count */}
                <Badge
                  variant="outline"
                  className="absolute top-5 right-5 border-glass-border bg-black/45 text-[11px] tracking-[0.16em] text-white/85 uppercase backdrop-blur-md"
                >
                  {collection.itemCount} pieces
                </Badge>

                {/* Name + CTA */}
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6">
                  <h3 className="text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.75)] sm:text-4xl">
                    {collection.name}
                  </h3>
                  <span className="flex items-center gap-2 text-sm font-semibold tracking-[0.18em] text-primary uppercase opacity-0 transition-all duration-500 ease-[var(--ease-luxe)] group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:opacity-100 translate-y-2">
                    Explore
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
