import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Leaf } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import {
  CATEGORY_META,
  GENDER_EMOJI,
  PRODUCTS,
  SITE,
  TRUST_BADGES,
  getProductById,
  getRelatedProducts,
} from "@/lib/site";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductActions } from "@/components/product/ProductActions";
import { ProductAccordion } from "@/components/product/ProductAccordion";
import { ProductCard } from "@/components/product/ProductCard";
import { ReviewSection } from "@/components/product/ReviewSection";
import { StarRating } from "@/components/product/StarRating";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ProductPageProps {
  /** Next 15 passes route params as a promise. */
  params: Promise<{ id: string }>;
}

/** Pre-render every catalogue page; unknown ids still render on demand. */
export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ id: product.id }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = getProductById(id);

  if (!product) {
    return { title: { absolute: "Product not found | LITTLE LUXE" } };
  }

  const title = `${product.name} — Ages ${product.ageRange.replace("Y", "")} | LITTLE LUXE`;
  const description = `${product.name} for ages ${product.ageRange.replace("Y", "")}. ${product.tagline} ${product.material}. ${formatPrice(product.price, product.currency)} with free shipping over $50.`;

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE.url}/product/${product.id}`,
      siteName: SITE.kidsBrand,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = getProductById(id);

  if (!product) notFound();

  const meta = CATEGORY_META[product.category];
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;
  const related = getRelatedProducts(product, 4);
  const isOrganic = product.material.toLowerCase().includes("organic");

  /* ---------- Structured data ---------- */
  const [ageMin, ageMax] = product.ageRange
    .replace("Y", "")
    .split("-")
    .map((value) => Number.parseInt(value, 10));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.id,
    color: product.colors.join(", "),
    material: product.material,
    category: product.category,
    audience: {
      "@type": "PeopleAudience",
      suggestedMinAge: Number.isNaN(ageMin) ? undefined : ageMin,
      suggestedMaxAge: Number.isNaN(ageMax) ? undefined : ageMax,
      suggestedGender: product.gender,
    },
    size: product.sizes,
    brand: { "@type": "Brand", name: SITE.kidsBrand },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
    offers: {
      "@type": "Offer",
      price: product.price.toFixed(2),
      priceCurrency: product.currency,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${SITE.url}/product/${product.id}`,
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <div className="relative">
      <script
        type="application/ld+json"
        // Structured data is static per product; no user input is interpolated.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(80%_100%_at_20%_0%,rgba(244,114,182,0.10)_0%,transparent_60%),radial-gradient(60%_90%_at_85%_5%,rgba(167,139,250,0.10)_0%,transparent_65%)]"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {/* ---------- Breadcrumb ---------- */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {[
              { label: "Home", href: "/" },
              { label: "Shop", href: "/shop" },
              {
                label: product.category,
                href: `/shop?category=${meta.slug}`,
              },
            ].map((crumb) => (
              <li key={crumb.href} className="flex items-center gap-1.5">
                <Link
                  href={crumb.href}
                  className="transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {crumb.label}
                </Link>
                <ChevronRight className="size-3 text-muted-foreground/60" />
              </li>
            ))}
            <li aria-current="page" className="text-foreground/80">
              {product.name}
            </li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          {/* ---------- LEFT: media (sticky on desktop) ---------- */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <ProductGallery product={product} />
          </div>

          {/* ---------- RIGHT: details ---------- */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.28em] text-lavender uppercase">
                <span aria-hidden className="mr-2">
                  {meta.emoji}
                </span>
                {product.category}
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {product.name}
              </h1>
            </div>

            {/* Badges + rating */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-glass-border bg-glass px-3 py-1.5 text-xs font-medium">
                Ages {product.ageRange.replace("Y", "")}
              </span>
              <span className="rounded-full border border-glass-border bg-glass px-3 py-1.5 text-xs font-medium">
                <span aria-hidden className="mr-1.5">
                  {GENDER_EMOJI[product.gender]}
                </span>
                {product.gender}
              </span>
              {isOrganic && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/12 px-3 py-1.5 text-xs font-medium text-emerald-400">
                  <Leaf className="size-3.5" />
                  Organic
                </span>
              )}
              <span className="flex items-center gap-2">
                <StarRating rating={product.rating} size="sm" reviewCount={product.reviewCount} />
                <a
                  href="#reviews"
                  className="text-xs text-muted-foreground underline-offset-4 transition-colors duration-300 hover:text-primary hover:underline"
                >
                  {product.reviewCount} reviews
                </a>
              </span>
            </div>

            {/* Price */}
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-4xl font-bold text-primary">
                {formatPrice(product.price, product.currency)}
              </span>
              {product.originalPrice && (
                <>
                  <span className="text-lg text-muted-foreground line-through">
                    {formatPrice(product.originalPrice, product.currency)}
                  </span>
                  {discount !== null && (
                    <Badge className="rounded-full border-rose/45 bg-rose/20 px-2.5 py-1 text-xs font-bold text-rose">
                      Save {discount}%
                    </Badge>
                  )}
                </>
              )}
            </div>

            {/* Description */}
            <p className="prose-kids max-w-xl text-base text-muted-foreground">
              {product.description}
            </p>

            {isOrganic && (
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-glass-border bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-400">
                <Leaf className="size-3.5" />
                {product.material}
              </p>
            )}

            <Separator className="bg-glass-border" />

            {/* Colour / size / quantity / CTA */}
            <ProductActions product={product} />

            {/* Age recommendation */}
            <p className="rounded-2xl border border-glass-border bg-lavender-soft px-4 py-3 text-sm">
              ✨ Perfect for ages{" "}
              <span className="font-semibold text-lavender">
                {product.ageRange.replace("Y", " years")}
              </span>
              {product.gender !== "Unisex" && ` · Designed for ${product.gender.toLowerCase()}`}
            </p>

            {/* Trust badges */}
            <ul className="grid grid-cols-2 gap-3">
              {TRUST_BADGES.map((badge) => (
                <li
                  key={badge.label}
                  className="flex items-center gap-2.5 rounded-2xl border border-glass-border bg-glass px-3.5 py-3 text-xs text-muted-foreground transition-colors duration-400 hover:border-rose/30 hover:text-foreground"
                >
                  <span aria-hidden className="text-base">
                    {badge.emoji}
                  </span>
                  {badge.label}
                </li>
              ))}
            </ul>

            {/* Accordions */}
            <ProductAccordion product={product} />
          </div>
        </div>

        <Separator className="my-16 bg-glass-border" />

        {/* ---------- Reviews ---------- */}
        <ReviewSection product={product} />

        <Separator className="my-16 bg-glass-border" />

        {/* ---------- Related ---------- */}
        <section aria-labelledby="related-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.3em] text-rose uppercase">
                You may also like
              </p>
              <h2
                id="related-heading"
                className="mt-3 text-3xl font-bold tracking-tight"
              >
                More Adorable Picks{" "}
                <span aria-hidden>🧸</span>
              </h2>
            </div>
            <Link
              href={`/shop?category=${meta.slug}`}
              className={cn(
                "text-sm tracking-[0.14em] text-primary uppercase underline-offset-4 transition-colors duration-300 hover:underline",
              )}
            >
              All {product.category}
            </Link>
          </div>

          <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {related.map((item, index) => (
              <ProductCard
                key={item.id}
                product={item}
                index={index}
                className="w-[70vw] shrink-0 snap-start sm:w-72"
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
