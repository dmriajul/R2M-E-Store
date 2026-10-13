"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/product/ProductCard";
import { SectionHeading } from "@/components/sections/SectionHeading";
import type { Product } from "@/types";

interface FeaturedCarouselProps {
  /** Curated/featured products, fetched on the server by the page. */
  products: Product[];
}

/** Tags that own their own arrow-key behaviour — never hijack those. */
const FORM_TAGS = ["INPUT", "TEXTAREA", "SELECT"] as const;

/**
 * Curated / featured collection — horizontal Embla carousel.
 *
 * Behaviour is **manual only**: no autoplay, `loop: false`, and no drag-free
 * momentum. Navigation is arrow buttons on desktop (`lg` and up) and native
 * swipe on touch devices; both drive the same `scrollPrev`/`scrollNext` API.
 *
 * Mobile slides are 85% wide so the next card always peeks in from the right —
 * the visual affordance that the rail is scrollable.
 *
 * Accessibility:
 *  - the rail is a `role="region"` carousel (W3C APG pattern);
 *  - ArrowLeft / ArrowRight step the rail when focus is inside it, except when
 *    the event came from a form control that needs those keys itself;
 *  - the arrows use the literal labels "Previous" / "Next" and are real
 *    `<button>`s that `disable` at the ends, so keyboard and screen-reader
 *    users can tell when there is nowhere left to go.
 */
export function FeaturedCarousel({ products }: FeaturedCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    loop: false,
    dragFree: false,
    skipSnaps: false,
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const sync = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    sync();
    emblaApi.on("select", sync).on("reInit", sync);
    return () => {
      emblaApi.off("select", sync).off("reInit", sync);
    };
  }, [emblaApi, sync]);

  /** Collapse the section when there is nothing curated yet. */
  if (products.length === 0) return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.isContentEditable || FORM_TAGS.includes(target.tagName as (typeof FORM_TAGS)[number])) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      emblaApi?.scrollPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      emblaApi?.scrollNext();
    }
  };

  return (
    <section
      aria-labelledby="featured-title"
      className="relative py-24 lg:py-32"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="featured-title"
          eyebrowKey="sections.featuredEyebrow"
          titleKey="sections.featured"
          descriptionKey="sections.featuredDescription"
        />

        {/* ---------- Rail ---------- */}
        {/* `touch-action: pan-y pinch-zoom` keeps one-finger vertical page
            scrolling on mobile while Embla owns horizontal drag. */}
        <div
          ref={emblaRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Featured products"
          onKeyDown={handleKeyDown}
          className="mt-12 overflow-hidden [touch-action:pan-y_pinch-zoom]"
        >
          <ul className="flex items-stretch">
            {products.map((product, index) => (
              <li
                key={product.id}
                className="mr-4 w-[85%] min-w-0 shrink-0 grow-0 last:mr-0 sm:mr-6 sm:w-[45%] lg:w-[calc((100%-3rem)/3)]"
              >
                <ProductCard
                  product={product}
                  index={index}
                  className="h-full"
                />
              </li>
            ))}
          </ul>
        </div>

        {/* ---------- Controls ---------- */}
        <div className="mt-8 flex items-center justify-between gap-4">
          {/* Mobile: tap targets + position indicator (swipe is the primary
              gesture). Desktop: hidden in favour of the arrows above. */}
          <div className="flex items-center gap-2.5 lg:hidden">
            {scrollSnaps.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => emblaApi?.scrollTo(index)}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === selectedIndex ? "true" : undefined}
                className={cn(
                  "h-1.5 cursor-pointer rounded-full transition-all duration-500 ease-[var(--ease-luxe)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  index === selectedIndex
                    ? "w-8 bg-primary"
                    : "w-4 bg-white/20 hover:bg-white/40",
                )}
              />
            ))}
          </div>

          {/* Desktop: previous / next. Disabled (not hidden) at the ends so the
              control never disappears and the state is announced. */}
          <div className="ml-auto hidden items-center gap-3 lg:flex">
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={!canScrollPrev}
              aria-label="Previous"
              className="inline-flex size-11 items-center justify-center rounded-full border border-glass-border bg-glass text-foreground transition-all duration-300 ease-[var(--ease-luxe)] hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              disabled={!canScrollNext}
              aria-label="Next"
              className="inline-flex size-11 items-center justify-center rounded-full border border-glass-border bg-glass text-foreground transition-all duration-300 ease-[var(--ease-luxe)] hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
