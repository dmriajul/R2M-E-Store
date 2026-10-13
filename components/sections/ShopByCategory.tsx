"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

/** Approximate pixel height of one `deltaMode === 1` (line) wheel step. */
const LINE_HEIGHT_PX = 16;

/**
 * Horizontal "Shop By Category" rail with fluid wheel mapping.
 *
 * The rail is a plain native horizontal scroller — no carousel engine, no
 * scroll snapping, no looping, and no step/lock logic — so movement is
 * continuous and 1:1 proportional to the input instead of advancing one
 * card at a time:
 *
 * - Scroll down (`deltaY > 0`) → cards glide right (`scrollLeft += deltaY`)
 * - Scroll up (`deltaY < 0`) → cards glide left (`scrollLeft += deltaY`)
 *
 * A native non-passive `wheel` listener performs the vertical-to-horizontal
 * mapping (React's synthetic `onWheel` is passive and cannot
 * `preventDefault()`). The page scroll is only captured while the rail can
 * still move in the requested direction; at either edge the event is left
 * alone so vertical page scrolling resumes instead of trapping the user.
 * Horizontal trackpad swipes (`deltaX`-dominant) are already horizontal, so
 * they are left to the browser's native horizontal scrolling. Touch users
 * get the same native horizontal scroll, and pinch-zoom is untouched.
 *
 * There are deliberately no arrow buttons and no pagination dots/dashes —
 * wheel, trackpad, and touch are the only navigation.
 */
export function ShopByCategory() {
  const language = useLanguageStore((state) => state.language);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      // Pinch-zoom (ctrl + wheel) belongs to the browser.
      if (event.ctrlKey) return;

      // Horizontal-dominant input (trackpad side-swipe, shift + wheel) is
      // already horizontal — let native horizontal scrolling handle it.
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      // Normalise wheel units to pixels so line/page-based wheels move at
      // the same proportional rate as pixel-based trackpads:
      // deltaMode 0 = pixels, 1 = lines, 2 = pages.
      const unit =
        event.deltaMode === 1
          ? LINE_HEIGHT_PX
          : event.deltaMode === 2
            ? viewport.clientWidth
            : 1;
      const deltaY = event.deltaY * unit;
      if (deltaY === 0) return;

      const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
      if (maxScrollLeft <= 0) return;

      // At either edge, release the gesture to the page — never trap the
      // user's vertical scroll inside an exhausted rail. The 1px tolerance
      // absorbs sub-pixel rounding at the far edge.
      const atStart = viewport.scrollLeft <= 0;
      const atEnd = viewport.scrollLeft >= maxScrollLeft - 1;
      if ((deltaY > 0 && atEnd) || (deltaY < 0 && atStart)) return;

      // Capture the gesture and map it 1:1 onto the horizontal axis.
      // Direct assignment (no snapping, no lock, no animated stepping)
      // keeps the glide fluid and proportional to scroll speed.
      event.preventDefault();
      viewport.scrollLeft += deltaY;
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return (
    <section id="collections" className="relative py-24 lg:py-32">
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

        {/* ---------- Rail (wheel / trackpad / touch only — no arrows, no dots) ---------- */}
        <div
          ref={viewportRef}
          className="mt-12 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
      </div>
    </section>
  );
}
