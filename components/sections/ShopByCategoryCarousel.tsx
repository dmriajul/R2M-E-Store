"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { Reveal } from "@/components/sections/Reveal";
import { t, translateCategory } from "@/lib/utils";
import { useLanguageStore } from "@/store/useLanguageStore";

interface CategoryCard {
  image: string;
  label: string;
  href: string;
  count: number;
}

interface ShopByCategoryCarouselProps {
  categories: CategoryCard[];
}

/** Do not consume arrow keys while a form control owns them. */
const FORM_TAGS = ["INPUT", "TEXTAREA", "SELECT"] as const;

/** Interactive Embla rail; category data and counts are rendered server-side. */
export function ShopByCategoryCarousel({
  categories,
}: ShopByCategoryCarouselProps) {
  const language = useLanguageStore((state) => state.language);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    loop: false,
    dragFree: false,
    watchDrag: true,
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const syncCarouselState = useCallback(() => {
    if (!emblaApi) return;

    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  const syncScrollSnaps = useCallback(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    syncScrollSnaps();
    syncCarouselState();
    emblaApi
      .on("select", syncCarouselState)
      .on("reInit", syncCarouselState)
      .on("reInit", syncScrollSnaps);

    return () => {
      emblaApi
        .off("select", syncCarouselState)
        .off("reInit", syncCarouselState)
        .off("reInit", syncScrollSnaps);
    };
  }, [emblaApi, syncCarouselState, syncScrollSnaps]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (
      target.isContentEditable ||
      FORM_TAGS.includes(target.tagName as (typeof FORM_TAGS)[number])
    ) {
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
    <div className="w-full min-w-0">
      {/* Reveal only the header; never transform the Embla viewport or slides. */}
      <Reveal className="w-full">
        <header className="flex items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">
              {t("common.catalogue", language)}
            </p>
            <h2
              id="collections-title"
              className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl"
            >
              {t("sections.collections", language)}
            </h2>
            <span
              aria-hidden
              className="mt-5 block h-px w-24 bg-gradient-to-r from-primary via-primary/50 to-transparent"
            />
          </div>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={!canScrollPrev}
              aria-label="Previous categories"
              className="inline-flex size-10 items-center justify-center rounded-full border border-glass-border bg-glass text-foreground transition-colors duration-300 hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              disabled={!canScrollNext}
              aria-label="Next categories"
              className="inline-flex size-10 items-center justify-center rounded-full border border-glass-border bg-glass text-foreground transition-colors duration-300 hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </header>
      </Reveal>

      <div
        ref={emblaRef}
        role="region"
        aria-roledescription="carousel"
        aria-labelledby="collections-title"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="mt-10 w-full min-w-0 overflow-hidden [touch-action:pan-y_pinch-zoom] focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none lg:cursor-grab lg:active:cursor-grabbing"
      >
        <ul className="flex gap-4 md:gap-6">
          {categories.map((category) => {
            const label = translateCategory(category.label, language);
            const countLabel = t("category.stylesCount", language).replace(
              "{count}",
              String(category.count),
            );

            return (
              <li
                key={category.image}
                className="min-w-0 flex-[0_0_86%] sm:flex-[0_0_62%] lg:flex-[0_0_38%]"
              >
                <Link
                  href={category.href}
                  className="group relative block aspect-[4/3] overflow-hidden rounded-3xl bg-[#101010] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background focus-visible:outline-none lg:aspect-[5/4]"
                >
                  <Image
                    src={`/images/categories/${category.image}.jpg`}
                    alt=""
                    fill
                    loading="lazy"
                    sizes="(min-width: 1280px) 462px, (min-width: 1024px) calc(38vw - 24px), (min-width: 640px) calc(62vw - 30px), calc(86vw - 28px)"
                    className="object-cover transition-[transform] duration-500 motion-safe:lg:group-hover:scale-[1.03] motion-reduce:transition-none"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-transparent"
                  />

                  <span className="absolute top-5 left-5 z-10 flex max-w-[85%] flex-col items-start gap-2 sm:top-6 sm:left-6">
                    <h3 className="text-2xl font-bold tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.55)] sm:text-3xl">
                      {label}
                    </h3>
                    <span className="text-xs font-medium tracking-wide text-white/85">
                      {countLabel}
                    </span>
                    <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold tracking-wide text-[#101010] shadow-sm transition-colors duration-300 group-hover:bg-white">
                      {t("common.explore", language)}
                      <ArrowRight className="size-3.5" aria-hidden />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 lg:hidden">
        {scrollSnaps.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => emblaApi?.scrollTo(index)}
            aria-label={`${t("carousel.goToSlide", language)} ${index + 1}`}
            aria-current={index === selectedIndex ? "true" : undefined}
            className={`size-1.5 rounded-full transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              index === selectedIndex ? "bg-primary" : "bg-white/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
