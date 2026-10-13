"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import { t, translateCategory } from "@/lib/utils";
import { useLanguageStore } from "@/store/useLanguageStore";

/**
 * Shop-by-category cover tiles.
 *
 * Cover photography lives in `/public/images/categories/<slug>.jpg` and is
 * always a real photographic JPG/PNG — there is deliberately no SVG or vector
 * placeholder artwork: a failed photo simply falls back to the card's dark
 * base surface while the label stays legible.
 */
interface CategoryTile {
  /** File basename under `/public/images/categories/`. */
  slug: string;
  /** English display label; run through `translateCategory` at render time. */
  label: string;
  /** Deep link into the shop catalogue (`?category=` expects a category slug). */
  href: string;
}

const CATEGORY_TILES: readonly CategoryTile[] = [
  {
    slug: "tops-tees",
    label: "Tops & Tees",
    href: "/shop?category=tops-tees",
  },
  {
    slug: "pants-bottoms",
    label: "Pants & Bottoms",
    href: "/shop?category=winter-bottoms-trousers",
  },
  {
    slug: "frocks-dresses",
    label: "Frocks & Dresses",
    href: "/shop?category=frocks-dresses",
  },
  {
    slug: "outerwear",
    label: "Outerwear",
    href: "/shop?category=jackets-coats",
  },
  {
    slug: "accessories",
    label: "Accessories",
    href: "/shop?category=accessories",
  },
] as const;

const EASE_LUXE = "ease-[var(--ease-luxe)]";

/**
 * Horizontal "Shop By Category" carousel.
 *
 * Mouse-wheel / trackpad scrolling is wired through Embla's
 * `embla-carousel-wheel-gestures` plugin so the strip slides left/right
 * without the page having to scroll first. The plugin listens on a single
 * wheel axis per instance, so two instances are mounted:
 *
 * - `forceWheelAxis: "y"` — a vertical mouse wheel (or vertical trackpad
 *   scroll) drives the horizontal carousel, exactly like a wheel-driven
 *   scroller; once the carousel hits either end, gesture releases and the
 *   page scroll resumes.
 * - `forceWheelAxis: "x"` — horizontal wheel / trackpad swipes slide the
 *   same strip natively.
 */
export function ShopByCategory() {
  const language = useLanguageStore((state) => state.language);
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "start",
      containScroll: "trimSnaps",
      loop: false,
      dragFree: false,
      skipSnaps: false,
    },
    [
      WheelGesturesPlugin({ forceWheelAxis: "y", wheelDraggingClass: "is-wheel-dragging" }),
      WheelGesturesPlugin({ forceWheelAxis: "x", wheelDraggingClass: "is-wheel-dragging" }),
    ],
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const syncSelection = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    syncSelection();
    emblaApi.on("select", syncSelection).on("reInit", syncSelection);
    return () => {
      emblaApi.off("select", syncSelection).off("reInit", syncSelection);
    };
  }, [emblaApi, syncSelection]);

  return (
    <section id="collections" className="relative py-24 lg:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ---------- Header + controls ---------- */}
        <div className="flex flex-wrap items-end justify-between gap-6">
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={!canScrollPrev}
              aria-label={t("common.back", language)}
              className="glass flex size-11 cursor-pointer items-center justify-center rounded-full text-white/85 transition-all duration-500 hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              disabled={!canScrollNext}
              aria-label={t("common.next", language)}
              className="glass flex size-11 cursor-pointer items-center justify-center rounded-full text-white/85 transition-all duration-500 hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        {/* ---------- Carousel ---------- */}
        {/* The viewport is the wheel-gesture target; `touch-pan-y` keeps the
            page scrollable with one finger while Embla owns horizontal drags. */}
        <div
          ref={emblaRef}
          className="mt-12 overflow-hidden [touch-action:pan-y_pinch-zoom]"
        >
          <ul className="flex items-stretch">
            {CATEGORY_TILES.map((tile) => {
              const label = translateCategory(tile.label, language);
              return (
                <li
                  key={tile.slug}
                  className="mr-4 w-[76%] min-w-0 shrink-0 grow-0 last:mr-0 sm:mr-6 sm:w-[44%] lg:w-[calc((100%-4.5rem)/4)]"
                >
                  <Link
                    href={tile.href}
                    className={`group relative block aspect-4/5 overflow-hidden rounded-3xl border border-glass-border bg-[#101010] transition-[border-color,box-shadow,transform] duration-500 ${EASE_LUXE} hover:-translate-y-1.5 hover:border-primary/45 hover:shadow-[0_0_46px_-14px_rgba(212,175,55,0.75)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
                  >
                    {/* Real photographic cover — no vector/SVG fallback art. */}
                    <Image
                      src={`/images/categories/${tile.slug}.jpg`}
                      alt={label}
                      fill
                      sizes="(min-width: 1024px) 280px, (min-width: 640px) 44vw, 76vw"
                      className={`object-cover transition-transform duration-700 ${EASE_LUXE} group-hover:scale-[1.06]`}
                    />
                    {/* Legibility scrim over the photo. */}
                    <span
                      aria-hidden
                      className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{
                        backgroundImage:
                          "radial-gradient(120% 80% at 50% 110%, rgba(212,175,55,0.28) 0%, transparent 70%)",
                      }}
                    />

                    <span className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 sm:p-6">
                      <span className="text-2xl font-bold tracking-tight text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.75)] sm:text-[1.7rem]">
                        {label}
                      </span>
                      <span
                        className={`flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-primary uppercase transition-all duration-500 ${EASE_LUXE} group-hover:translate-x-1 group-hover:text-white`}
                      >
                        {t("common.explore", language)}
                        <ArrowRight className="size-4" />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ---------- Snap indicators ---------- */}
        <div className="mt-8 flex items-center justify-center gap-2.5">
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => emblaApi?.scrollTo(index)}
              aria-label={`${t("carousel.goToSlide", language)} ${index + 1}`}
              aria-current={index === selectedIndex ? "true" : undefined}
              className={`h-1.5 cursor-pointer rounded-full transition-all duration-500 ${EASE_LUXE} focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                index === selectedIndex
                  ? "w-8 bg-primary"
                  : "w-4 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
