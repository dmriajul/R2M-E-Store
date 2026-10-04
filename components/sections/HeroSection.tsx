"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SceneLoadingFallback } from "@/components/three/SceneLoadingFallback";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

/**
 * The 3D scene is client-only: WebGL cannot be server-rendered, and loading it
 * lazily keeps three/fiber/postprocessing out of the initial page bundle.
 */
const HeroScene = dynamic(() => import("@/components/three/HeroScene"), {
  ssr: false,
  loading: () => <SceneLoadingFallback />,
});

const EASE_LUXE = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

function buildItemVariants(reducedMotion: boolean): Variants {
  return {
    hidden: { opacity: 0, y: reducedMotion ? 0 : 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reducedMotion ? 0.5 : 0.8, ease: EASE_LUXE },
    },
  };
}

export function HeroSection() {
  const reducedMotion = usePrefersReducedMotion();
  const item = buildItemVariants(reducedMotion);

  const scrollToFeatured = () => {
    document
      .getElementById("featured")
      ?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <section
      id="hero"
      className="relative flex min-h-screen items-center overflow-hidden"
    >
      {/* Ambient depth — keeps the hero premium even before WebGL paints. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_90%_at_75%_35%,rgba(212,175,55,0.16)_0%,rgba(212,175,55,0.04)_35%,transparent_65%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(70%_60%_at_15%_80%,rgba(0,240,255,0.07)_0%,transparent_60%)]"
      />

      {/* 3D layer — absolute, behind the copy, never intercepts the pointer. */}
      <div className="absolute inset-0 z-0">
        <HeroScene />
      </div>

      {/* Legibility scrim: vertical on phones (copy sits under the form),
          horizontal from the left on desktop (copy owns the left column). */}
      <div
        aria-hidden
        className="absolute inset-0 z-[1] bg-gradient-to-b from-background/85 via-background/60 to-background lg:bg-gradient-to-r lg:from-background lg:via-background/55 lg:to-transparent"
      />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="max-w-xl lg:max-w-2xl"
        >
          {/* Badge */}
          <motion.div variants={item}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-[11px] font-semibold tracking-[0.28em] text-primary uppercase backdrop-blur-md">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_2px_rgba(212,175,55,0.8)]"
              />
              New Collection 2025
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={item}
            className="mt-6 text-6xl font-bold tracking-tight text-white md:text-8xl"
          >
            Redefine
            <br />
            Luxury
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={item}
            className="mt-6 max-w-md text-lg leading-relaxed text-gray-400"
          >
            Experience craftsmanship meets innovation
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={item}
            className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button
              asChild
              size="lg"
              className="group h-12 bg-primary px-8 text-sm font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:bg-primary hover:shadow-[0_0_40px_-6px_rgba(212,175,55,0.85)]"
            >
              <Link href="/shop">
                Shop Now
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-glass-border bg-glass px-8 text-sm font-semibold tracking-[0.16em] text-white uppercase backdrop-blur-md transition-all duration-500 ease-[var(--ease-luxe)] hover:border-primary/60 hover:bg-white/10 hover:text-white"
            >
              <button type="button" onClick={scrollToFeatured}>
                Explore
              </button>
            </Button>
          </motion.div>

          {/* Micro trust row */}
          <motion.dl
            variants={item}
            className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-4 text-xs tracking-[0.18em] text-muted-foreground uppercase"
          >
            <div className="flex items-center gap-2">
              <dt className="sr-only">Shipping</dt>
              <dd>Free worldwide shipping</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Warranty</dt>
              <dd>5-year warranty</dd>
            </div>
          </motion.dl>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <button
        type="button"
        onClick={scrollToFeatured}
        aria-label="Scroll to the curated selection"
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded-full p-2 text-muted-foreground transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex flex-col items-center gap-2">
          <span className="text-[10px] tracking-[0.3em] uppercase">Scroll</span>
          <motion.span
            animate={reducedMotion ? undefined : { y: [0, 8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="flex size-8 items-center justify-center rounded-full border border-glass-border"
          >
            <ChevronDown className="size-4" />
          </motion.span>
        </span>
      </button>
    </section>
  );
}
