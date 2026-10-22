import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/lib/seo";
import { SITE, categoryToSlug } from "@/lib/site";
import { getCatalogue, isCatalogueOutage } from "@/lib/data/products";
import { ProductCard } from "@/components/product/ProductCard";
import { CatalogueEmptyState } from "@/components/shop/CatalogueEmptyState";
import { CatalogueUnavailable } from "@/components/shop/CatalogueUnavailable";
import type { Product, ProductCategory } from "@/types";

export const dynamic = "force-dynamic";

const TITLE = "Collections | Mukra";
const DESCRIPTION =
  "Explore every Mukra collection — winter layers, dresses, tees, bottoms and accessories, curated in small numbers for ages 0–14.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/collections" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: `${SITE.url}/collections`,
    siteName: SITE.kidsBrand,
  },
};

/** Stable display order — mirrors the storefront's category carousel. */
const CATEGORY_ORDER: readonly ProductCategory[] = [
  "Tops & Tees",
  "Jackets & Coats",
  "Sweatshirts & Hoodies",
  "Sweaters & Cardigans",
  "Winter Bottoms / Trousers",
  "Winter Sets & Tracksuits",
  "Innerwear & Thermals",
  "Accessories",
];

/** Group the catalogue into collection rows, keeping CATEGORY_ORDER. */
function groupByCollection(products: readonly Product[]): {
  category: ProductCategory;
  pieces: Product[];
}[] {
  const buckets = new Map<ProductCategory, Product[]>();

  for (const product of products) {
    // A product can belong to several categories; it is listed once, under its
    // primary one, so the page never repeats the same card row after row.
    const bucket = buckets.get(product.category) ?? [];
    bucket.push(product);
    buckets.set(product.category, bucket);
  }

  const ordered = CATEGORY_ORDER.filter((category) => buckets.has(category));
  // Any category not in the fixed order still gets its row, appended last.
  const extras = [...buckets.keys()].filter((category) => !ordered.includes(category));

  return [...ordered, ...extras].map((category) => ({
    category,
    pieces: buckets.get(category) ?? [],
  }));
}

/**
 * Collections index.
 *
 * A real route (the navbar's "Collections" link still uses the home-page
 * anchor, which is the curated carousel). This page lists the catalogue grouped
 * by collection, so shared links land on browsable rows instead of bouncing the
 * visitor back to the home page.
 *
 * Empty / unconfigured catalogues keep the header and render the premium
 * `<CatalogueEmptyState />`; only a configured-but-unreachable database gets
 * the maintenance notice.
 */
export default async function CollectionsPage() {
  const { products, status } = await getCatalogue({ limit: 100 });
  const groups = groupByCollection(products);
  const outage = isCatalogueOutage(status);

  return (
    <div className="relative">
      <JsonLd
        id="collections-breadcrumbs"
        data={breadcrumbSchema([
          { name: "Home", href: "/" },
          { name: "Collections", href: "/collections" },
        ])}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(80%_100%_at_20%_0%,rgba(212,175,55,0.12)_0%,transparent_65%),radial-gradient(60%_90%_at_85%_5%,rgba(167,139,250,0.10)_0%,transparent_60%)]"
      />

      {/* ---------- Header ---------- */}
      <header className="relative mx-auto w-full max-w-7xl px-4 pt-8 pb-2 sm:px-6 lg:px-8 lg:pt-10">
        <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">
          Catalogue
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Collections
        </h1>
        <span
          aria-hidden
          className="mt-4 block h-px w-24 bg-gradient-to-r from-primary via-primary/50 to-transparent"
        />
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Every piece, grouped the way the atelier organises it — small
          collections, made to be worn hard and handed down.
        </p>

        {!outage && groups.length > 0 && (
          <nav aria-label="Jump to a collection" className="mt-7 flex flex-wrap gap-2">
            {groups.map(({ category }) => (
              <a
                key={category}
                href={`#collection-${categoryToSlug(category)}`}
                className="inline-flex h-9 items-center rounded-full border border-glass-border bg-glass px-4 text-xs font-medium tracking-[0.1em] text-muted-foreground uppercase transition-colors duration-300 hover:border-primary/45 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {category}
              </a>
            ))}
          </nav>
        )}
      </header>

      {outage ? (
        <CatalogueUnavailable />
      ) : groups.length === 0 ? (
        /* Reachable-but-empty (or not-yet-connected) catalogue: premium
           invitation, never an error. */
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <CatalogueEmptyState mode={status === "unconfigured" ? "setup" : "empty"} />
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-4 py-12 sm:px-6 lg:gap-16 lg:px-8 lg:py-16">
          {groups.map(({ category, pieces }) => (
            <section
              key={category}
              id={`collection-${categoryToSlug(category)}`}
              aria-labelledby={`collection-title-${categoryToSlug(category)}`}
              className="scroll-mt-28"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.28em] text-primary uppercase">
                    Collection
                  </p>
                  <h2
                    id={`collection-title-${categoryToSlug(category)}`}
                    className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"
                  >
                    {category}
                  </h2>
                </div>
                <Link
                  href={`/shop?category=${categoryToSlug(category)}`}
                  className="group inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  View {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
                  <ArrowRight
                    aria-hidden
                    className="size-3.5 transition-transform duration-300 group-hover:translate-x-1"
                  />
                </Link>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 xl:grid-cols-4">
                {pieces.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    priority={index < 4}
                    className="h-full"
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
