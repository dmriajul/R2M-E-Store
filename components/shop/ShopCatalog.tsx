"use client";

import { useEffect, useMemo, useState } from "react";
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

interface ShopCatalogProps {
  /** Filters parsed from the URL on the server, so shared links render filtered. */
  initialFilters: ShopFilterState;
}

/**
 * Shop grid + filtering.
 *
 * All filtering happens client-side against the mock catalogue. The URL is kept
 * in sync with `history.replaceState` (no router navigation, so typing on a
 * pill stays instant) — which keeps filter combinations shareable.
 */
export function ShopCatalog({ initialFilters }: ShopCatalogProps) {
  const [filters, setFilters] = useState<ShopFilterState>(initialFilters);
  const [visibleCount, setVisibleCount] = useState(SHOP_PAGE_SIZE);

  const products = useMemo(
    () =>
      getProducts({
        category: filters.category,
        age: filters.age,
        gender: filters.gender,
        sort: filters.sort,
      }),
    [filters.category, filters.age, filters.gender, filters.sort],
  );

  const visible = products.slice(0, visibleCount);
  const hasMore = products.length > visible.length;

  // Mirror filters into the address bar and rewind the paging.
  useEffect(() => {
    const query = filtersToSearchParams(filters);
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [filters]);

  const updateFilters = (patch: Partial<ShopFilterState>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setVisibleCount(SHOP_PAGE_SIZE);
  };

  const clearFilters = () => {
    setFilters((current) => ({
      ...DEFAULT_SHOP_FILTERS,
      view: current.view,
    }));
    setVisibleCount(SHOP_PAGE_SIZE);
  };

  const isList = filters.view === "list";

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
                  />
                ))}
              </AnimatePresence>
            </motion.div>

            {hasMore && (
              <div className="mt-12 flex flex-col items-center gap-3">
                <Button
                  onClick={() => setVisibleCount((count) => count + SHOP_PAGE_SIZE)}
                  variant="outline"
                  className="group h-12 gap-2 rounded-full border-glass-border bg-glass px-8 text-xs font-semibold tracking-[0.18em] uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:border-primary/50 hover:text-primary"
                >
                  <Sparkles className="size-4 transition-transform duration-300 group-hover:rotate-12" />
                  Load more
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
