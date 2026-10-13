"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { SHOP_CATEGORIES } from "@/lib/config";
import type { ShopCategoryCounts } from "@/lib/data/shop-categories";

const CATEGORY_IMAGE_FALLBACK = "/images/placeholder-category.jpg";
const BLUR_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 25'%3E%3Crect width='40' height='25' fill='%23092418'/%3E%3C/svg%3E";

function CategoryCard({
  category,
  count,
  index,
  total,
}: {
  category: (typeof SHOP_CATEGORIES)[number];
  count: number;
  index: number;
  total: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const formattedCount = new Intl.NumberFormat("en-BD").format(count);
  const imageSrc = imageFailed ? CATEGORY_IMAGE_FALLBACK : category.image;
  const isInitiallyActive = index === 0;

  return (
    <div
      data-category-slide
      data-active={isInitiallyActive}
      role="group"
      aria-roledescription="slide"
      aria-label={`${category.title}, ${index + 1} of ${total}`}
      style={{
        transform: isInitiallyActive ? "scale(1)" : "scale(0.92)",
        opacity: isInitiallyActive ? 1 : 0.7,
        filter: isInitiallyActive ? "blur(0px)" : "blur(0.7px)",
      }}
      className="min-w-0 shrink-0 basis-[82%] pl-4 will-change-transform will-change-[opacity,filter] sm:basis-[45.45%] lg:basis-[30%]"
    >
      <Link
        href={`/shop?category=${category.slug}`}
        aria-label={`Shop ${category.title}${count === 0 ? ", coming soon" : `, ${count} ${count === 1 ? "item" : "items"}`}`}
        className="group relative block aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-[#092418] focus-visible:ring-2 focus-visible:ring-[#C9A961] focus-visible:outline-none"
      >
        <div
          aria-hidden="true"
          className="absolute inset-y-0 -left-[5%] w-[110%] will-change-transform"
          style={{ transform: "translate3d(var(--image-parallax-x, 0px), 0, 0)" }}
        >
          <Image
            src={imageSrc}
            alt={`${category.title} for kids`}
            fill
            sizes="(max-width: 639px) 82vw, (max-width: 1023px) 46vw, 30vw"
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
            onError={() => setImageFailed(true)}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </div>

        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black/80 via-black/30 to-transparent"
        />

        {count === 0 && (
          <span className="absolute top-4 right-4 rounded-full border border-white/25 bg-black/55 px-3 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur-md">
            Coming Soon
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <h3 className="text-xl leading-tight font-bold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] md:text-2xl">
              {category.title}
            </h3>
            <span className="mt-1 block text-sm font-medium text-[#C9A961]">
              {formattedCount} {count === 1 ? "item" : "items"}
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/80 bg-white/10 px-5 py-2 text-sm font-medium text-white backdrop-blur-md transition-all duration-300 group-hover:bg-white group-hover:text-black">
            Shop Now <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>
    </div>
  );
}

export function ShopByCategory({ counts }: { counts: ShopCategoryCounts }) {
  const headingId = useId();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    dragFree: false,
    loop: true,
    skipSnaps: true,
  });

  const updateSlideMotion = useCallback(() => {
    if (!emblaApi) return;

    const viewportRect = emblaApi.rootNode().getBoundingClientRect();
    const viewportCenter = viewportRect.left + viewportRect.width / 2;

    for (const slide of emblaApi.slideNodes()) {
      const slideRect = slide.getBoundingClientRect();
      const slideWidth = slide.clientWidth || slideRect.width;
      if (slideWidth === 0) continue;

      const slideCenter = slideRect.left + slideRect.width / 2;
      const signedDistance = (slideCenter - viewportCenter) / slideWidth;
      const sideStrength = Math.min(Math.abs(signedDistance), 1);
      const scale = 1 - sideStrength * 0.08;
      const opacity = 1 - sideStrength * 0.3;
      const blur = sideStrength * 0.7;
      const parallaxX = -Math.max(-1, Math.min(1, signedDistance)) * slideWidth * 0.1;

      slide.style.transform = `scale(${scale})`;
      slide.style.opacity = `${opacity}`;
      slide.style.filter = `blur(${blur}px)`;
      slide.style.setProperty("--image-parallax-x", `${parallaxX}px`);
      slide.dataset.active = sideStrength < 0.07 ? "true" : "false";
    }
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    let frame = 0;
    const scheduleSlideUpdate = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateSlideMotion();
      });
    };

    scheduleSlideUpdate();
    emblaApi.on("scroll", scheduleSlideUpdate);
    emblaApi.on("select", scheduleSlideUpdate);
    emblaApi.on("reInit", scheduleSlideUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      emblaApi.off("scroll", scheduleSlideUpdate);
      emblaApi.off("select", scheduleSlideUpdate);
      emblaApi.off("reInit", scheduleSlideUpdate);
    };
  }, [emblaApi, updateSlideMotion]);

  return (
    <section
      id="collections"
      aria-labelledby={headingId}
      className="relative py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 sm:mb-10">
          <p className="text-xs font-semibold tracking-[0.3em] text-[#C9A961] uppercase">
            The MUKRA edit
          </p>
          <h2 id={headingId} className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Shop by Category
          </h2>
          <span
            aria-hidden="true"
            className="mt-5 block h-px w-24 bg-gradient-to-r from-[#C9A961] via-[#C9A961]/50 to-transparent"
          />
        </div>

        <div
          id={`${headingId}-carousel`}
          ref={emblaRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Shop by category. Drag or swipe to browse."
          className="overflow-hidden touch-pan-y"
        >
          <div className="-ml-4 flex">
            {SHOP_CATEGORIES.map((category, index) => (
              <CategoryCard
                key={category.slug}
                category={category}
                count={counts[category.slug] ?? 0}
                index={index}
                total={SHOP_CATEGORIES.length}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
