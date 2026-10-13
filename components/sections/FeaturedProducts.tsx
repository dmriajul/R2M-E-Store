"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Plus } from "lucide-react";
import { ProductArtwork } from "@/components/product/ProductArtwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { formatPrice, t, translateCategory } from "@/lib/utils";
import { useCartStore } from "@/store/useCartStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import type { Product } from "@/types";

const EASE_LUXE = [0.22, 1, 0.36, 1] as const;

interface ProductCardProps {
  product: Product;
  index: number;
  reducedMotion: boolean;
  duplicate: boolean;
}

function AddToCartButton({
  product,
  duplicate,
}: {
  product: Product;
  duplicate: boolean;
}) {
  const language = useLanguageStore((state) => state.language);
  const addItem = useCartStore((state) => state.addItem);
  const inCart = useCartStore((state) =>
    state.items.some((item) => item.id === product.id),
  );
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    addItem(product, 1);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1600);
  };

  return (
    <Button
      type="button"
      onClick={handleAdd}
      disabled={product.stock === 0}
      tabIndex={duplicate ? -1 : undefined}
      className="h-9 w-full gap-2 bg-primary text-xs font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_28px_-6px_rgba(212,175,55,0.9)]"
    >
      {justAdded ? (
        <>
          <Check className="size-3.5" />
          {inCart ? t("common.inBag", language) : t("common.added", language)}
        </>
      ) : (
        <>
          <Plus className="size-3.5" />
          {t("common.addToCart", language)}
        </>
      )}
    </Button>
  );
}

function ProductCard({
  product,
  index,
  reducedMotion,
  duplicate,
}: ProductCardProps) {
  const language = useLanguageStore((state) => state.language);
  const discount = product.compareAtPrice
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : null;

  return (
    <motion.article
      aria-hidden={duplicate || undefined}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: reducedMotion ? 0.5 : 0.7,
        delay: reducedMotion ? 0 : index * 0.09,
        ease: EASE_LUXE,
      }}
      whileHover={
        reducedMotion
          ? undefined
          : {
              y: -8,
              scale: 1.02,
              transition: { duration: 0.3, ease: EASE_LUXE },
            }
      }
      className="group glass pointer-events-auto relative flex w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl p-3 will-change-transform transition-[box-shadow,border-color] duration-500 ease-[var(--ease-luxe)] hover:border-primary/45 hover:shadow-[0_0_46px_-14px_rgba(212,175,55,0.75)] sm:w-[320px]"
    >
      <Link
        href={`/product/${product.slug || product.id}`}
        aria-label={`View ${product.name}`}
        tabIndex={duplicate ? -1 : undefined}
        className="group pointer-events-auto flex flex-1 cursor-pointer flex-col rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="relative block aspect-4/5 overflow-hidden rounded-xl bg-[#101010]">
          <ProductArtwork
            product={product}
            size="card"
            imageClassName="transition-transform duration-500 ease-out group-hover:scale-[1.08]"
            className="absolute inset-0 h-full w-full rounded-xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_70%_15%,rgba(0,240,255,0.12)_0%,transparent_60%)]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-6 bottom-6 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
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
            {translateCategory(product.category, language)}
          </Badge>
        </div>

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
        </div>
      </Link>

      <div className="pointer-events-auto mt-4">
        <AddToCartButton product={product} duplicate={duplicate} />
      </div>
    </motion.article>
  );
}

interface ProductMarqueeProps {
  products: Product[];
  reverse?: boolean;
  reducedMotion: boolean;
}

function ProductMarquee({
  products,
  reverse = false,
  reducedMotion,
}: ProductMarqueeProps) {
  const repeatedProducts = Array.from(
    { length: Math.max(products.length, 10) },
    (_, index) => products[index % products.length]!,
  );
  return (
    <div className="marquee-viewport overflow-hidden py-4">
      <div
        className={
          reverse
            ? "animate-marquee-right flex w-max flex-nowrap will-change-transform hover:[animation-play-state:paused]"
            : "animate-marquee-left flex w-max flex-nowrap will-change-transform hover:[animation-play-state:paused]"
        }
      >
        {[0, 1].map((copy) => (
          <div
            key={copy}
            aria-hidden={copy === 1 || undefined}
            className="flex shrink-0 flex-nowrap gap-6 pr-6"
          >
            {repeatedProducts.map((product, index) => (
              <ProductCard
                key={`${copy}-${index}-${product.id}`}
                product={product}
                index={index}
                reducedMotion={reducedMotion}
                duplicate={copy === 1 || index >= products.length}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface FeaturedProductsProps {
  products: Product[];
  id?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
}

export function FeaturedProducts({
  products,
  id = "featured",
  eyebrow = "Featured",
  title = "Curated Selection",
  description = "A curated selection from the current release — each made in small numbers and finished by hand.",
}: FeaturedProductsProps) {
  const language = useLanguageStore((state) => state.language);
  const reducedMotion = usePrefersReducedMotion();
  const row1Products = products.filter((_, index) => index % 2 === 0);
  const row2Products = products.filter((_, index) => index % 2 === 1);
  const translations: Record<
    string,
    { eyebrow: string; title: string; description: string }
  > = {
    featured: {
      eyebrow: "sections.featuredEyebrow",
      title: "sections.featured",
      description: "sections.featuredDescription",
    },
    "new-arrivals": {
      eyebrow: "sections.newArrivalsEyebrow",
      title: "sections.newArrivals",
      description: "sections.newArrivalsDescription",
    },
    "best-sellers": {
      eyebrow: "sections.bestSellersEyebrow",
      title: "sections.bestSellers",
      description: "sections.bestSellersDescription",
    },
  };
  const keys = translations[id];
  const sectionEyebrow = keys ? t(keys.eyebrow, language) : eyebrow;
  const sectionTitle = keys ? t(keys.title, language) : title;
  const sectionDescription = keys ? t(keys.description, language) : description;

  if (products.length === 0) return null;

  return (
    <section id={id} className="relative w-full overflow-hidden py-24 lg:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">
              {sectionEyebrow}
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              {sectionTitle}
            </h2>
            <span
              aria-hidden
              className="mt-5 block h-px w-24 bg-gradient-to-r from-primary via-primary/50 to-transparent"
            />
          </div>
          <div className="flex w-full max-w-sm flex-col gap-4 sm:w-auto sm:items-end">
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-right">
              {sectionDescription}
            </p>
            <Button
              asChild
              variant="ghost"
              className="group w-fit gap-2 text-sm tracking-[0.16em] text-primary uppercase transition-colors duration-300 hover:bg-glass hover:text-primary"
            >
              <Link href="/shop">
                {t("common.viewAll", language)}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </header>
      </div>

      <div
        role="region"
        aria-label={language === "bn" ? `${sectionTitle} ক্যারোসেল` : `${sectionTitle} carousel`}
        className="mt-14 space-y-5 overflow-hidden px-4 pb-6 sm:px-6 lg:px-8"
      >
        {row1Products.length > 0 && (
          <ProductMarquee products={row1Products} reducedMotion={reducedMotion} />
        )}
        {row2Products.length > 0 && (
          <ProductMarquee
            products={row2Products}
            reverse
            reducedMotion={reducedMotion}
          />
        )}
      </div>

    </section>
  );
}
