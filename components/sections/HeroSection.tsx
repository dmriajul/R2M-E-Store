"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { useLanguageStore } from "@/store/useLanguageStore";
import type { HeroSettings } from "@/lib/hero-settings";
import { t } from "@/lib/utils";

const EASE_LUXE = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

/**
 * Hero copy variants.
 *
 * Animates **opacity and transform only** — an earlier version also tweened a
 * `filter: blur()`, which is off-limits under the animation rules (and is a
 * comparatively expensive property to animate on every hero element at once).
 */
function buildItemVariants(reducedMotion: boolean): Variants {
  return {
    hidden: {
      opacity: 0,
      y: reducedMotion ? 0 : 40,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reducedMotion ? 0.5 : 0.8, ease: EASE_LUXE },
    },
  };
}

export function HeroSection({ settings }: { settings: HeroSettings }) {
  const reducedMotion = usePrefersReducedMotion();
  const item = buildItemVariants(reducedMotion);
  const language = useLanguageStore((state) => state.language);

  const scrollToFeatured = () => {
    document
      .getElementById("featured")
      ?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  };

  const badgeText =
    settings.heroBadgeText ||
    (language === "bn" ? "✨ প্রিমিয়াম কিডস ফ্যাশন" : "✨ Premium Kids Fashion");
  const titleText = settings.heroTitle || t("hero.title", language);
  const subtitleText = settings.heroSubtitle || t("hero.subtitle", language);
  const shopNowText = t("common.shopNow", language);
  const exploreText = t("common.explore", language);
  const primaryCtaText = settings.primaryCtaText || shopNowText;
  const primaryCtaLink = settings.primaryCtaLink || "/shop";
  const secondaryCtaText = settings.secondaryCtaText || exploreText;
  const secondaryCtaLink = settings.secondaryCtaLink || "#featured";
  const mediaUrl = settings.heroMediaUrl || "/hero-fashion.mp4";
  const showImage = settings.heroMediaType === "image" && Boolean(settings.heroMediaUrl);
  const freeShippingText = t("shipping.freeNationwide", language);
  const easyReturnsText = language === "bn" ? "সহজ রিটার্নস" : "30-day easy returns";
  const scrollText = language === "bn" ? "স্ক্রল করুন" : "Scroll";

  return (
    <section
      id="hero"
      className="relative flex min-h-screen items-center overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-gradient-to-b from-[#0A3622]/70 via-[#050816] to-[#050816]"
      />
      {showImage ? (
        // Cloudinary banners get an f_auto,q_auto,w_…,c_limit srcset (AVIF/WebP
        // from the CDN) plus a preload hint; other URLs keep loading as before.
        <OptimizedImage
          src={mediaUrl}
          alt=""
          preset="hero"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 z-0 rounded-none opacity-75"
          fallback={<span aria-hidden />}
        />
      ) : (
        <video
          src={mediaUrl}
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          className="absolute inset-0 z-0 h-full w-full object-cover opacity-75"
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-[#050816]/80 via-[#050816]/40 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#050816] via-transparent to-[#050816]/30"
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-[-15%] z-[1] bg-[radial-gradient(ellipse_at_25%_32%,rgba(10,54,34,0.55),transparent_48%),radial-gradient(ellipse_at_74%_42%,rgba(212,175,55,0.2),transparent_34%)]"
        animate={
          reducedMotion
            ? undefined
            : { scale: [1, 1.08, 1], opacity: [0.75, 1, 0.75] }
        }
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
      >
        {[
          { left: "18%", top: "28%", delay: 0 },
          { left: "32%", top: "72%", delay: 1.1 },
          { left: "58%", top: "20%", delay: 2.2 },
          { left: "76%", top: "62%", delay: 0.6 },
          { left: "88%", top: "36%", delay: 1.7 },
        ].map((particle) => (
          <motion.span
            key={`${particle.left}-${particle.top}`}
            className="absolute size-1 rounded-full bg-[#D4AF37] shadow-[0_0_12px_3px_rgba(212,175,55,0.55)]"
            style={{ left: particle.left, top: particle.top }}
            animate={{ y: [0, -18, 0], opacity: [0.3, 0.9, 0.3] }}
            transition={{
              duration: 4,
              delay: particle.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <div className="relative z-20 mx-auto w-full max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="max-w-xl lg:max-w-2xl"
        >
          {/* Badge */}
          <motion.div variants={item}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-[11px] font-semibold tracking-[0.28em] text-primary uppercase backdrop-blur-md glass-pill-glow">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_2px_rgba(212,175,55,0.8)]"
              />
              {badgeText}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={item}
            className="notranslate mt-6 text-6xl font-bold tracking-tight text-white md:text-8xl"
          >
            {titleText}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={item}
            className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground"
          >
            {subtitleText}
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
              <Link href={primaryCtaLink}>
                {primaryCtaText}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-glass-border bg-glass px-8 text-sm font-semibold tracking-[0.16em] text-white uppercase backdrop-blur-md transition-all duration-500 ease-[var(--ease-luxe)] hover:border-primary/60 hover:bg-white/10 hover:text-white"
            >
              <Link href={secondaryCtaLink}>{secondaryCtaText}</Link>
            </Button>
          </motion.div>

          {/* Micro trust row */}
          <motion.dl
            variants={item}
            className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-4 text-xs tracking-[0.18em] text-muted-foreground uppercase"
          >
            <div className="flex items-center gap-2">
              <dt className="sr-only">Shipping</dt>
              <dd>{freeShippingText}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Warranty</dt>
              <dd>{easyReturnsText}</dd>
            </div>
          </motion.dl>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <button
        type="button"
        onClick={scrollToFeatured}
        aria-label={`${scrollText} to the curated selection`}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded-full p-2 text-muted-foreground transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex flex-col items-center gap-2">
          <span className="text-[10px] tracking-[0.3em] uppercase">{scrollText}</span>
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
