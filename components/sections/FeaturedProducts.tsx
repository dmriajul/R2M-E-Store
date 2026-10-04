"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Plus, Check } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { MOCK_PRODUCTS } from "@/lib/site";
import { useCartStore } from "@/store/useCartStore";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/types";

const EASE_LUXE = [0.22, 1, 0.36, 1] as const;

/* -------------------------------------------------------------------------- */
/*  Card                                                                      */
/* -------------------------------------------------------------------------- */

function AddToCartButton({ product }: { product: Product }) {
  const addItem = useCartStore((state) => state.addItem);
  const inCart = useCartStore((state) =>
    state.items.some((item) => item.id === product.id),
  );
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    addItem(product, 1);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1600);
  };

  return (
    <Button
      type="button"
      onClick={handleAdd}
      disabled={product.stock === 0}
      className="h-9 w-full gap-2 bg-primary text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_28px_-6px_rgba(212,175,55,0.9)]"
    >
      {justAdded ? (
        <>
          <Check className="size-3.5" />
          {inCart ? "In bag" : "Added"}
        </>
      ) : (
        <>
          <Plus className="size-3.5" />
          Add to Cart
        </>
      )}
    </Button>
  );
}

interface ProductCardProps {
  product: Product;
  index: number;
  reducedMotion: boolean;
}

function ProductCard({ product, index, reducedMotion }: ProductCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const inView = useInView(cardRef, { once: true, amount: 0.25 });
  const discount = product.compareAtPrice
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : null;

  return (
    <motion.article
      ref={cardRef}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 32 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{
        duration: reducedMotion ? 0.5 : 0.7,
        delay: reducedMotion ? 0 : index * 0.09,
        ease: EASE_LUXE,
      }}
      whileHover={reducedMotion ? undefined : { y: -8 }}
      className="group glass relative flex w-[78vw] shrink-0 snap-start flex-col overflow-hidden rounded-2xl p-3 transition-[box-shadow,border-color] duration-500 ease-[var(--ease-luxe)] hover:border-primary/45 hover:shadow-[0_0_46px_-14px_rgba(212,175,55,0.75)] sm:w-[22rem]"
    >
      {/* Media placeholder — pure CSS gradient, no external images. */}
      <div className="relative aspect-4/5 overflow-hidden rounded-xl bg-[linear-gradient(145deg,rgba(212,175,55,0.26)_0%,rgba(212,175,55,0.06)_38%,rgba(0,0,0,0.75)_100%)]">
        <span
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(80%_60%_at_70%_15%,rgba(0,240,255,0.16)_0%,transparent_60%)]"
        />
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center px-6 text-center text-2xl font-bold tracking-tight text-white/90 transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:scale-105 md:text-3xl"
        >
          {product.name}
        </span>
        <span
          aria-hidden
          className="absolute inset-x-6 bottom-6 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        />

        {discount !== null && (
          <Badge className="absolute top-3 left-3 border-0 bg-primary text-[10px] font-bold tracking-wider text-primary-foreground">
            −{discount}%
          </Badge>
        )}
        <Badge
          variant="outline"
          className="absolute top-3 right-3 border-glass-border bg-black/40 text-[10px] tracking-[0.18em] text-white/80 uppercase backdrop-blur-md"
        >
          {product.category}
        </Badge>
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {product.tagline}
        </p>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary">
            {formatPrice(product.price, product.currency)}
          </span>
          {product.compareAtPrice && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(product.compareAtPrice, product.currency)}
            </span>
          )}
        </div>

        <div className="mt-4">
          <AddToCartButton product={product} />
        </div>
      </div>
    </motion.article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section                                                                   */
/* -------------------------------------------------------------------------- */

export function FeaturedProducts() {
  const reducedMotion = usePrefersReducedMotion();
  const featured = MOCK_PRODUCTS.filter((product) => product.featured);
  // Top up with the rest of the catalogue so the row always shows four pieces.
  const products = [
    ...featured,
    ...MOCK_PRODUCTS.filter((product) => !product.featured),
  ].slice(0, 4);

  return (
    <section id="featured" className="relative py-24 lg:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">
              Featured
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Curated Selection
            </h2>
            <span
              aria-hidden
              className="mt-5 block h-px w-24 bg-gradient-to-r from-primary via-primary/50 to-transparent"
            />
          </div>

          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Four pieces from the current release — each made in small numbers and
            finished by hand.
          </p>
        </div>
      </div>

      {/* Horizontal rail: native scrolling, snap points, no scroll-jacking. */}
      <div className="mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            index={index}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>

      <div className="mx-auto mt-4 flex w-full max-w-7xl justify-end px-4 sm:px-6 lg:px-8">
        <Button
          asChild
          variant="ghost"
          className="group gap-2 text-sm tracking-[0.16em] text-primary uppercase transition-colors duration-300 hover:bg-glass hover:text-primary"
        >
          <Link href="/shop">
            View All
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
