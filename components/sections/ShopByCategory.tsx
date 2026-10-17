"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { t, translateCategory } from "@/lib/utils";
import { useLanguageStore } from "@/store/useLanguageStore";

/**
 * Shop-by-category cover tiles.
 *
 * A cover uploaded in the console (`Category.image`, Cloudinary
 * `mukra/categories`) wins; otherwise the bundled photography in
 * `/public/images/categories/<slug>.jpg` is used. Either way it is a real
 * photo — there is deliberately no SVG or vector placeholder artwork: a failed
 * photo simply falls back to the card's dark base surface while the label
 * stays legible.
 */
interface CategoryTile {
  /** File basename under `/public/images/categories/`. */
  slug: string;
  /** `Category.slug` whose uploaded cover replaces the bundled photo. */
  category: string;
  /** English display label; run through `translateCategory` at render time. */
  label: string;
  /** Deep link into the shop catalogue (`?category=` expects a category slug). */
  href: string;
}

const CATEGORY_TILES: readonly CategoryTile[] = [
  {
    slug: "tops-tees",
    category: "tops-tees",
    label: "Tops & Tees",
    href: "/shop?category=tops-tees",
  },
  {
    slug: "pants-bottoms",
    category: "winter-bottoms-trousers",
    label: "Pants & Bottoms",
    href: "/shop?category=winter-bottoms-trousers",
  },
  {
    slug: "frocks-dresses",
    category: "frocks-dresses",
    label: "Frocks & Dresses",
    href: "/shop?category=frocks-dresses",
  },
  {
    slug: "outerwear",
    category: "jackets-coats",
    label: "Outerwear",
    href: "/shop?category=jackets-coats",
  },
  {
    slug: "accessories",
    category: "accessories",
    label: "Accessories",
    href: "/shop?category=accessories",
  },
] as const;

const EASE_LUXE = "ease-[var(--ease-luxe)]";

/** Cool-down after a wheel step so a single gesture advances exactly one card. */
const WHEEL_STEP_LOCK_MS = 600;

/**
 * Horizontal "Shop By Category" carousel with Sungrow-style wheel control.
 *
 * A native `wheel` listener on the Embla viewport maps wheel input straight to
 * slide navigation:
 *
 * - Scroll down (`deltaY > 0`) → `emblaApi.scrollNext()` (carousel moves right)
 * - Scroll up (`deltaY < 0`) → `emblaApi.scrollPrev()` (carousel moves left)
 *
 * The handler calls `preventDefault()` while the pointer is over the carousel
 * so the page never scrolls underneath it. A short lock after each step keeps
 * momentum bursts from skipping past cards. Touch/pointer drag stays with
 * Embla's native drag engine, so mobile keeps natural drag-to-scroll.
 */
export interface ShopByCategoryProps {
  /**
   * Uploaded covers keyed by category slug (`getCategoryImageMap()`); tiles
   * without one keep their bundled photo.
   */
  images?: Readonly<Record<string, string>>;
}

export function ShopByCategory({ images = {} }: ShopByCategoryProps) {
  const language = useLanguageStore((state) => state.language);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    loop: false,
    dragFree: false,
    skipSnaps: false,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const syncSelection = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
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

  /**
   * Wheel → slide mapping. A native listener is required because React's
   * synthetic `onWheel` is passive and cannot `preventDefault()` the page
   * scroll — and pinning the page while hovering the carousel is exactly the
   * behaviour we want.
   */
  useEffect(() => {
    if (!emblaApi) return;
    const viewport = emblaApi.rootNode();
    let locked = false;
    let unlockTimer: number | undefined;

    const handleWheel = (event: WheelEvent) => {
      // Pinch-zoom (ctrl + wheel) belongs to the browser.
      if (event.ctrlKey) return;

      // Pin the page while the pointer is over the carousel.
      event.preventDefault();

      // Vertical mouse wheel is the primary axis; horizontal wheel deltas
      // (trackpad side-swipes, shift + wheel) map the same direction.
      const delta =
        Math.abs(event.deltaY) >= Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;
      if (delta === 0 || locked) return;

      // One gesture → one card. Wheel momentum events during the cool-down
      // are swallowed (and prevented) instead of queueing extra slides.
      locked = true;
      unlockTimer = window.setTimeout(() => {
        locked = false;
      }, WHEEL_STEP_LOCK_MS);

      if (delta > 0) {
        emblaApi.scrollNext();
      } else {
        emblaApi.scrollPrev();
      }
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
      window.clearTimeout(unlockTimer);
    };
  }, [emblaApi]);

  return (
    <section id="collections" className="relative py-16 lg:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ---------- Header ---------- */}
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

        {/* ---------- Carousel ---------- */}
        {/* `touch-action: pan-y pinch-zoom` keeps one-finger page scrolling on
            mobile while Embla owns horizontal drag gestures. */}
        <div
          ref={emblaRef}
          className="mt-10 overflow-hidden [touch-action:pan-y_pinch-zoom]"
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
                    <OptimizedImage
                      src={images[tile.category] ?? `/images/categories/${tile.slug}.jpg`}
                      alt={label}
                      fill
                      sizes="(min-width: 1024px) 280px, (min-width: 640px) 44vw, 76vw"
                      className="absolute inset-0 rounded-none"
                      imageClassName={`transition-transform duration-700 ${EASE_LUXE} group-hover:scale-[1.06]`}
                      fallback={<span aria-hidden />}
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

        {/* ---------- Snap indicators (no arrow buttons — wheel + drag only) ---------- */}
        <div className="mt-7 flex items-center justify-center gap-2.5">
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
