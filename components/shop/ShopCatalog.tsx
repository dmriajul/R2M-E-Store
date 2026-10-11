"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProducts } from "@/lib/site";
import {
  DEFAULT_SHOP_FILTERS,
  SHOP_PAGE_SIZE,
  filtersToSearchParams,
  hasActiveFilters,
  type ShopFilterState,
} from "@/lib/shop";
import { ProductCard } from "@/components/product/ProductCard";
import { FilterBar } from "@/components/shop/FilterBar";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types";

interface ShopCatalogProps {
  /** Filters parsed from the URL on the server, so shared links render filtered. */
  initialFilters: ShopFilterState;
  products: Product[];
}

/**
 * Shop grid + filtering.
 *
 * All filtering happens client-side against the server-provided catalogue. The URL is kept
 * in sync with `history.replaceState` (no router navigation, so typing on a
 * pill stays instant) — which keeps filter combinations shareable.
 */
export function ShopCatalog({ initialFilters, products: catalogue }: ShopCatalogProps) {
  const [filters, setFilters] = useState<ShopFilterState>(initialFilters);
  const [visibleCount, setVisibleCount] = useState(SHOP_PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreTimer = useRef<number | undefined>(undefined);

  const products = useMemo(
    () =>
      getProducts({
        category: filters.category,
        age: filters.age,
        gender: filters.gender,
        sort: filters.sort,
      }, catalogue),
    [catalogue, filters.category, filters.age, filters.gender, filters.sort],
  );

  const visible = products.slice(0, visibleCount);
  const hasMore = products.length > visible.length;

  useEffect(
    () => () => {
      if (loadMoreTimer.current !== undefined) {
        window.clearTimeout(loadMoreTimer.current);
      }
    },
    [],
  );

  // Mirror filters into the address bar and rewind the paging.
  useEffect(() => {
    const query = filtersToSearchParams(filters);
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [filters]);

  const updateFilters = (patch: Partial<ShopFilterState>) => {
    setIsLoadingMore(false);
    if (loadMoreTimer.current !== undefined) {
      window.clearTimeout(loadMoreTimer.current);
      loadMoreTimer.current = undefined;
    }
    setFilters((current) => ({ ...current, ...patch }));
    setVisibleCount(SHOP_PAGE_SIZE);
  };

  const clearFilters = () => {
    setIsLoadingMore(false);
    if (loadMoreTimer.current !== undefined) {
      window.clearTimeout(loadMoreTimer.current);
      loadMoreTimer.current = undefined;
    }
    setFilters((current) => ({
      ...DEFAULT_SHOP_FILTERS,
      view: current.view,
    }));
    setVisibleCount(SHOP_PAGE_SIZE);
  };

  const isList = filters.view === "list";

  const loadMore = () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    loadMoreTimer.current = window.setTimeout(() => {
      setVisibleCount((count) => count + SHOP_PAGE_SIZE);
      setIsLoadingMore(false);
      loadMoreTimer.current = undefined;
    }, 450);
  };

  return (
    <>
      <FilterBar
        filters={filters}
        onChange={updateFilters}
        resultCount={products.length}
      />

      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            {filters.category === "All" ? "All Pieces" : filters.category}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {products.length} {products.length === 1 ? "item" : "items"}
            </span>
          </h2>

          {hasActiveFilters(filters) && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="h-8 rounded-full px-3 text-xs tracking-[0.14em] text-muted-foreground uppercase transition-colors duration-300 hover:bg-white/5 hover:text-rose"
            >
              Clear filters
            </Button>
          )}
        </div>

        {products.length === 0 ? (
          <div className="glass-soft flex flex-col items-center gap-4 rounded-3xl px-6 py-20 text-center">
            <span className="text-6xl" aria-hidden>
              🧸
            </span>
            <h3 className="text-xl font-semibold">No items found for this filter</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Try a different age group or category — there is plenty more in the
              wardrobe.
            </p>
            <Button
              onClick={clearFilters}
              className="mt-2 h-10 rounded-full bg-primary px-6 text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 hover:shadow-[0_0_28px_-8px_rgba(212,175,55,0.9)]"
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            <motion.div
              layout
              className={cn(
                "grid gap-5",
                isList
                  ? "grid-cols-1"
                  : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
              )}
            >
              <AnimatePresence initial={false}>
                {visible.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    index={index}
                    variant={filters.view}
                    /* Only the first row is above the fold. */
                    priority={index < 4}
                  />
                ))}
                {isLoadingMore &&
                  Array.from(
                    { length: Math.min(SHOP_PAGE_SIZE, products.length - visible.length) },
                    (_, index) => (
                      <div
                        key={`loading-skeleton-${index}`}
                        aria-hidden="true"
                        className={cn(
                          "relative overflow-hidden rounded-3xl border border-primary/10 bg-white/[0.025]",
                          isList ? "h-44" : "aspect-[4/5]",
                        )}
                      >
                        <span className="absolute inset-0 motion-safe:animate-[gold-shimmer_1.6s_ease-in-out_infinite] bg-[linear-gradient(110deg,transparent_25%,rgba(212,175,55,0.11)_48%,transparent_70%)] [background-size:200%_100%]" />
                        <span className="absolute inset-x-4 bottom-5 h-3 rounded-full bg-white/5" />
                        <span className="absolute inset-x-4 bottom-11 h-3 w-2/3 rounded-full bg-white/5" />
                      </div>
                    ),
                  )}
              </AnimatePresence>
            </motion.div>

            {hasMore && (
              <div className="mt-12 flex flex-col items-center gap-3">
                <Button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  aria-busy={isLoadingMore}
                  variant="outline"
                  className={cn(
                    "group relative isolate h-12 gap-2 overflow-hidden rounded-full border border-primary/30 bg-[#100e08]/80 px-8 text-xs font-semibold tracking-[0.14em] text-primary uppercase shadow-[0_0_28px_-18px_rgba(212,175,55,0.8)] transition-all duration-500 ease-[var(--ease-luxe)] before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.17),transparent_72%)] before:opacity-70 before:transition-opacity before:duration-500 hover:border-primary/60 hover:text-[#f6e7ad] hover:shadow-[0_0_34px_-12px_rgba(212,175,55,0.65)] hover:before:opacity-100 active:scale-[0.98] motion-safe:hover:animate-[gold-breathe_2.4s_ease-in-out_infinite] disabled:cursor-wait disabled:opacity-90",
                    isLoadingMore && "motion-safe:animate-[gold-breathe_1.6s_ease-in-out_infinite]",
                  )}
                >
                  {isLoadingMore ? (
                    <span className="relative inline-flex size-5 items-center justify-center">
                      <span className="absolute inset-0 rounded-full border border-primary/25" />
                      <span className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-primary border-r-primary/50" />
                      <Sparkles aria-hidden className="size-3 text-[#f6e7ad]" />
                    </span>
                  ) : (
                    <Sparkles className="size-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                  )}
                  {isLoadingMore ? "Unveiling treasures…" : "Unveil More Treasures"}
                  {!isLoadingMore && <span aria-hidden className="text-sm">💛</span>}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Showing {visible.length} of {products.length}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
