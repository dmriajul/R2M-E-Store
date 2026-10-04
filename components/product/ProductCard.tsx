"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Eye, Heart, Plus } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import {
  BADGE_STYLES,
  CATEGORY_META,
  COLOR_HEX,
  DEFAULT_SWATCH,
  GENDER_EMOJI,
} from "@/lib/site";
import { useCartStore } from "@/store/useCartStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { ProductArtwork } from "@/components/product/ProductArtwork";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { QuickViewDialog } from "@/components/product/QuickViewDialog";
import { StarRating } from "@/components/product/StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types";

export interface ProductCardProps {
  product: Product;
  /** `grid` = vertical tile, `list` = full-width row. */
  variant?: "grid" | "list";
  /** Stagger index applied to the entrance animation. */
  index?: number;
  /** Above-the-fold card: let next/image preload it (never more than ~4). */
  priority?: boolean;
  className?: string;
}

const EASE_LUXE = [0.22, 1, 0.36, 1] as const;

/** Heart toggle, shared by both card variants and the detail page. */
export function WishlistButton({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const isWishlisted = useWishlistStore((state) => state.ids.includes(product.id));
  const toggle = useWishlistStore((state) => state.toggle);

  return (
    <button
      type="button"
      onClick={() => toggle(product.id)}
      aria-pressed={isWishlisted}
      aria-label={
        isWishlisted
          ? `Remove ${product.name} from wishlist`
          : `Add ${product.name} to wishlist`
      }
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full border border-glass-border bg-black/35 backdrop-blur-md transition-all duration-300 ease-[var(--ease-luxe)] hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        isWishlisted ? "text-rose" : "text-white/70 hover:text-rose",
        className,
      )}
    >
      <Heart
        className={cn("size-4", isWishlisted && "fill-rose")}
        aria-hidden
      />
    </button>
  );
}

export function AddToCartButton({
  product,
  size = "sm",
  className,
}: {
  product: Product;
  size?: "sm" | "lg";
  className?: string;
}) {
  const addItem = useCartStore((state) => state.addItem);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addItem(product, 1);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <Button
      type="button"
      onClick={handleAdd}
      disabled={!product.inStock}
      className={cn(
        "w-full rounded-full bg-primary font-semibold tracking-[0.14em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)]",
        "hover:shadow-[0_0_30px_-8px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:scale-[1.02]",
        size === "sm" ? "h-10 text-[11px]" : "h-13 text-sm",
        className,
      )}
    >
      {added ? (
        <>
          <Check className="size-4" /> Added
        </>
      ) : product.inStock ? (
        <>
          <Plus className="size-4" /> Add to Cart
        </>
      ) : (
        "Out of stock"
      )}
    </Button>
  );
}

/** Small colour swatch row; the visible swatch inherits the product palette. */
function ColorDots({ colors, max = 4 }: { colors: string[]; max?: number }) {
  const shown = colors.slice(0, max);
  const extra = colors.length - shown.length;

  return (
    <span className="flex items-center gap-1.5" aria-label={`Colours: ${colors.join(", ")}`}>
      {shown.map((color) => (
        <span
          key={color}
          className="size-3.5 rounded-full border border-white/25 shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
          style={{ backgroundColor: COLOR_HEX[color] ?? DEFAULT_SWATCH }}
          title={color}
        />
      ))}
      {extra > 0 && (
        <span className="text-[10px] text-muted-foreground">+{extra}</span>
      )}
    </span>
  );
}

/**
 * Catalogue tile. Renders as a vertical card or a full-width row, animates in
 * with a stagger and advertises `layout` so the shop grid can reflow items when
 * filters change (used together with <AnimatePresence>).
 */
export function ProductCard({
  product,
  variant = "grid",
  index = 0,
  priority = false,
  className,
}: ProductCardProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const meta = CATEGORY_META[product.category];
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;
  const isList = variant === "list";

  const entrance = {
    initial: { opacity: 0, y: reducedMotion ? 0 : 24, scale: reducedMotion ? 1 : 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: reducedMotion ? 1 : 0.97 },
    transition: {
      duration: reducedMotion ? 0.3 : 0.5,
      delay: reducedMotion ? 0 : Math.min(index, 8) * 0.045,
      ease: EASE_LUXE,
    },
  };

  /* Artwork box: shared by the real photo and the gradient fallback tile. */
  const artworkClass = cn(
    "transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:scale-[1.06]",
    isList ? "h-full min-h-32 w-32 sm:w-44" : "aspect-4/5 w-full",
  );

  return (
    <>
      <motion.article
        layout={!reducedMotion}
        {...entrance}
        whileHover={reducedMotion ? undefined : { y: -6 }}
        className={cn(
          "group glass-soft shadow-playful relative flex overflow-hidden rounded-3xl transition-[box-shadow,border-color] duration-500 ease-[var(--ease-luxe)] hover:border-rose/35 hover:shadow-playful-hover focus-within:border-rose/35",
          isList ? "flex-row gap-0" : "flex-col",
          className,
        )}
      >
        {/* ---------- Artwork ---------- */}
        <div className={cn("relative shrink-0", isList ? "w-32 sm:w-44" : "")}>
          <Link
            href={`/product/${product.id}`}
            className="block focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            tabIndex={-1}
            aria-hidden
          >
            <OptimizedImage
              src={product.images[0]}
              alt={
                product.colors[0]
                  ? `${product.name} in ${product.colors[0]}`
                  : product.name
              }
              preset="card"
              priority={priority}
              className={artworkClass}
              /* Placeholder products (no photography yet) keep the gradient tile. */
              fallback={<ProductArtwork product={product} className={artworkClass} />}
            />
          </Link>

          {product.badge && (
            <Badge
              className={cn(
                "absolute top-3 left-3 border text-[10px] font-bold tracking-wider uppercase",
                BADGE_STYLES[product.badge],
              )}
            >
              {product.badge}
            </Badge>
          )}

          <WishlistButton
            product={product}
            className="absolute top-3 right-3"
          />

          {discount !== null && (
            <span className="absolute bottom-3 left-3 rounded-full bg-rose/90 px-2.5 py-1 text-[10px] font-bold text-white">
              −{discount}%
            </span>
          )}

          {/* Quick-view overlay (grid only — the list row has room for a button) */}
          {!isList && (
            <div className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-black/35 opacity-0 backdrop-blur-[2px] transition-opacity duration-400 ease-[var(--ease-luxe)] group-hover:opacity-100 group-focus-within:opacity-100 lg:flex">
              <button
                type="button"
                onClick={() => setQuickViewOpen(true)}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-glass-border bg-black/60 px-4 py-2 text-[11px] font-semibold tracking-[0.16em] text-white uppercase backdrop-blur-md transition-transform duration-300 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Eye className="size-3.5" />
                Quick view
              </button>
            </div>
          )}
        </div>

        {/* ---------- Details ---------- */}
        <div
          className={cn(
            "flex flex-1 flex-col gap-3 p-4",
            isList && "sm:p-5",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/product/${product.id}`}
                className="block truncate text-[15px] font-medium text-foreground transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {product.name}
              </Link>
              {isList && (
                <p className="prose-kids mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {product.tagline}
                </p>
              )}
            </div>
            {!isList && (
              <span
                className="emoji-pop shrink-0 text-lg"
                aria-label={meta.emoji}
                title={product.category}
              >
                {meta.emoji}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Ages {product.ageRange.replace("Y", "")}
            </span>
            <span
              className="text-sm"
              title={product.gender}
              aria-label={`For ${product.gender}`}
            >
              {GENDER_EMOJI[product.gender]}
            </span>
            <ColorDots colors={product.colors} />
          </div>

          <StarRating rating={product.rating} reviewCount={product.reviewCount} size="sm" />

          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-primary">
              {formatPrice(product.price, product.currency)}
            </span>
            {product.originalPrice && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.originalPrice, product.currency)}
              </span>
            )}
          </div>

          <div className={cn("mt-auto flex gap-2", isList && "sm:max-w-xs")}>
            <AddToCartButton product={product} />
            {isList && (
              <Button
                asChild
                variant="outline"
                className="shrink-0 rounded-full border-glass-border bg-glass text-[11px] tracking-[0.14em] uppercase transition-colors duration-300 hover:border-rose/40 hover:text-rose"
              >
                <Link href={`/product/${product.id}`}>View</Link>
              </Button>
            )}
          </div>
        </div>
      </motion.article>

      <QuickViewDialog
        product={product}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
      />
    </>
  );
}
