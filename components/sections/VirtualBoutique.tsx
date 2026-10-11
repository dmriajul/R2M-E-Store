"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { formatPrice, t, translateCategory } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { ProductArtwork } from "@/components/product/ProductArtwork";
import { useLanguageStore } from "@/store/useLanguageStore";
import type { Product } from "@/types";

export function VirtualBoutique({ products }: { products: Product[] }) {
  const looks = products
    .filter((product) => product.virtualBoutique)
    .slice(0, 3);

  if (looks.length === 0) return null;

  return <BoutiqueShowcase looks={looks} />;
}

function getShortDescription(product: Product) {
  const source = product.tagline || product.description;
  const plainText = source
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = plainText.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? plainText;
  const characters = Array.from(sentence);
  if (characters.length <= 145) return sentence;

  const shortened = characters.slice(0, 145).join("");
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > 0 ? lastSpace : 145).trimEnd()}…`;
}

function BoutiqueShowcase({ looks }: { looks: Product[] }) {
  const language = useLanguageStore((state) => state.language);
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [isMounted, setIsMounted] = useState(false);
  const [activeLook, setActiveLook] = useState(0);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const { scrollYProgress } = useScroll({
    target: isMounted ? sectionRef : undefined,
    offset: ["start start", "end end"],
  });
  const leftDoor = useTransform(scrollYProgress, [0, 0.22], ["0%", "-100%"]);
  const rightDoor = useTransform(scrollYProgress, [0, 0.22], ["0%", "100%"]);
  const artworkScale = useTransform(scrollYProgress, [0, 0.22], [0.94, 1]);
  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const nextLook = Math.min(
      looks.length - 1,
      Math.floor(progress / (1 / looks.length)),
    );
    setActiveLook((current) => (current === nextLook ? current : nextLook));
  });

  const product = looks[activeLook];
  if (!product) return null;

  return (
    <section
      ref={sectionRef}
      aria-label={language === "bn" ? "MUKRA ভার্চুয়াল বুটিক" : "MUKRA virtual boutique"}
      className="relative w-full overflow-x-clip bg-[#050816] py-12"
      style={{ height: `${Math.max(3, looks.length) * 100}svh` }}
    >
      <div className="sticky top-16 min-h-[calc(100svh-4rem)] lg:top-20 lg:min-h-[640px]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_48%,rgba(212,175,55,0.13),transparent_48%)]"
        />
        <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:py-10">
          <div className="relative z-10 flex min-w-0 w-full flex-col justify-center space-y-4 lg:col-span-5">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reducedMotion ? 0 : -12 }}
                transition={{ duration: reducedMotion ? 0.12 : 0.38, ease: "easeOut" }}
                className="flex min-w-0 flex-col space-y-4"
              >
                <p className="text-[10px] tracking-[0.2em] text-white/45 uppercase">
                  {translateCategory(product.category, language)} · {product.ageRange}
                </p>
                <h2 className="break-words text-2xl leading-tight font-semibold text-white sm:text-3xl">
                  {product.name}
                </h2>
                <p className="max-w-md break-words text-sm leading-relaxed text-white/65 sm:text-base">
                  {getShortDescription(product)}
                </p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-4 pt-1">
                  <p className="text-xl font-medium tracking-wide text-[#D4AF37]">
                    {formatPrice(product.price, product.currency)}
                  </p>
                  <Link
                    href={`/product/${product.slug}`}
                    className="inline-flex w-fit max-w-full shrink-0 items-center gap-3 border-b border-[#D4AF37]/45 pb-2 text-[10px] tracking-[0.2em] text-white/75 uppercase transition-colors hover:text-[#D4AF37]"
                  >
                    {t("common.discoverLook", language)} <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="group relative isolate flex min-w-0 w-full min-h-[500px] items-center justify-center lg:col-span-7 lg:min-h-[560px]">
            <div className="absolute inset-[10%] z-0 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.12),transparent_68%)]" />
            <motion.div
              className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl lg:max-w-lg"
              style={{ perspective: 1100, scale: artworkScale }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.96, rotateY: reducedMotion ? 0 : 8 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  exit={{ opacity: 0, scale: 0.96, rotateY: reducedMotion ? 0 : -8 }}
                  transition={{ duration: reducedMotion ? 0.12 : 0.38, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full"
                >
                  <BoutiqueImageCarousel product={product} />
                </motion.div>
              </AnimatePresence>
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 z-20 h-full w-1/2 origin-left border-r border-[#D4AF37]/50 bg-[linear-gradient(110deg,#0d1422,#172033)] shadow-2xl"
                style={{
                  x: reducedMotion ? "-100%" : leftDoor,
                  backfaceVisibility: "hidden",
                }}
              >
                <span className="absolute top-1/2 right-3 size-2 -translate-y-1/2 rounded-full bg-[#D4AF37]/70 shadow-[0_0_14px_rgba(212,175,55,.55)]" />
              </motion.div>
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 z-20 h-full w-1/2 origin-right border-l border-[#D4AF37]/50 bg-[linear-gradient(250deg,#0d1422,#172033)] shadow-2xl"
                style={{
                  x: reducedMotion ? "100%" : rightDoor,
                  backfaceVisibility: "hidden",
                }}
              >
                <span className="absolute top-1/2 left-3 size-2 -translate-y-1/2 rounded-full bg-[#D4AF37]/70 shadow-[0_0_14px_rgba(212,175,55,.55)]" />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BoutiqueImageCarousel({ product }: { product: Product }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeImage, setActiveImage] = useState(0);
  const images = product.images.length > 0 ? product.images.slice(0, 4) : [""];
  const hasMultipleImages = images.length > 1;

  const scrollToImage = (index: number) => {
    const nextIndex = (index + images.length) % images.length;
    const viewport = viewportRef.current;
    const slide = slideRefs.current[nextIndex];
    if (!viewport || !slide) return;
    viewport.scrollTo({
      left: slide.offsetLeft - (viewport.clientWidth - slide.clientWidth) / 2,
      behavior: "smooth",
    });
  };

  const updateActiveImage = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const viewportCenter =
      viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    slideRefs.current.forEach((slide, index) => {
      if (!slide) return;
      const rect = slide.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - viewportCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveImage((current) =>
      current === closestIndex ? current : closestIndex,
    );
  };

  return (
    <div className="relative aspect-[3/4] min-h-[500px] w-full max-w-md overflow-hidden rounded-2xl lg:max-w-lg">
      <div
        ref={viewportRef}
        onScroll={updateActiveImage}
        role="region"
        aria-label={`${product.name} images`}
        aria-roledescription="carousel"
        className="absolute inset-0 flex items-center snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-[10%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((image, index) => (
          <div
            key={`${product.id}-${image}-${index}`}
            ref={(element) => {
              slideRefs.current[index] = element;
            }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${images.length}`}
            className="h-[90%] w-auto aspect-[3/4] shrink-0 snap-center transition-[transform,opacity] duration-500 ease-[var(--ease-luxe)]"
            style={{
              opacity: activeImage === index ? 1 : 0.5,
              transform: `scale(${activeImage === index ? 1 : 0.95})`,
            }}
          >
            <ProductArtwork
              product={product}
              index={index}
              size="detail"
              className="relative h-full w-full overflow-hidden rounded-2xl object-cover shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)]"
            />
          </div>
        ))}
      </div>

      {hasMultipleImages && (
        <>
          <button
            type="button"
            onClick={() => scrollToImage(activeImage - 1)}
            aria-label="Previous product image"
            className="absolute top-1/2 left-2 z-30 -translate-y-1/2 rounded-full border border-white/15 bg-[#050816]/70 p-2 text-white/80 opacity-70 shadow-lg backdrop-blur transition hover:border-[#D4AF37]/50 hover:text-[#D4AF37] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#D4AF37] lg:opacity-0 lg:group-hover:opacity-100"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollToImage(activeImage + 1)}
            aria-label="Next product image"
            className="absolute top-1/2 right-2 z-30 -translate-y-1/2 rounded-full border border-white/15 bg-[#050816]/70 p-2 text-white/80 opacity-70 shadow-lg backdrop-blur transition hover:border-[#D4AF37]/50 hover:text-[#D4AF37] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#D4AF37] lg:opacity-0 lg:group-hover:opacity-100"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>

          <div className="absolute right-[10%] bottom-2 z-30 flex items-center justify-end gap-2">
            <div className="flex items-center gap-1.5" aria-label="Choose product image">
              {images.map((image, index) => (
                <button
                  key={`image-dot-${image}-${index}`}
                  type="button"
                  onClick={() => scrollToImage(index)}
                  aria-label={`Show image ${index + 1}`}
                  aria-current={activeImage === index ? "true" : undefined}
                  className={`size-2 rounded-full transition-all ${
                    activeImage === index
                      ? "w-5 bg-[#D4AF37]"
                      : "bg-white/30 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
            <span className="ml-1 text-[10px] tracking-[0.2em] text-white/50 tabular-nums">
              {String(activeImage + 1).padStart(2, "0")} /{" "}
              {String(images.length).padStart(2, "0")}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
