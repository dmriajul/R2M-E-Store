import type { Metadata } from "next";
import { ShopCatalog } from "@/components/shop/ShopCatalog";
import { filtersFromSearchParams } from "@/lib/shop";
import { SITE } from "@/lib/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/lib/seo";
import { listProducts } from "@/lib/data/products";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { CatalogueUnavailable } from "@/components/shop/CatalogueUnavailable";
import type { Product } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Kids Fashion Collection | Mukra" },
  description:
    "Shop the Mukra kids collection — organic cotton dresses, tees, bottoms, shoes, outerwear and accessories for ages 0–14. Free shipping over ৳500, cash on delivery and 30-day easy returns.",
  keywords: [
    "kids fashion",
    "children's clothing",
    "organic kids clothes",
    "toddler outfits",
    "kids shoes",
    "baby clothes",
  ],
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "Kids Fashion Collection | Mukra",
    description:
      "Adorable, hard-wearing kids clothing in organic fabrics — ages 0 to 14.",
    type: "website",
    url: `${SITE.url}/shop`,
    siteName: SITE.kidsBrand,
  },
};

interface ShopPageProps {
  /** Next 15 hands searchParams to the page as a promise. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  // Filters are resolved on the server so a shared link paints the right grid.
  const initialFilters = filtersFromSearchParams(params);

  // The catalogue comes from the database only. When it cannot be reached the
  // page renders its maintenance state — never a baked-in sample catalogue.
  const { products, unavailable } = await listProducts().then(
    (result) => ({ ...result, unavailable: false }),
    (error: unknown) => {
      if (error instanceof Error && error.name === "DatabaseUnavailableError") {
        return { products: [] as Product[], source: "database" as const, unavailable: true };
      }
      throw error;
    },
  );

  return (
    <div className="relative">
      <JsonLd
        id="shop-breadcrumbs"
        data={breadcrumbSchema([
          { name: "Home", href: "/" },
          { name: "Shop", href: "/shop" },
        ])}
      />

      {/* Soft, warm ambience for the kids line. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(90%_100%_at_15%_0%,rgba(244,114,182,0.14)_0%,transparent_60%),radial-gradient(70%_90%_at_85%_10%,rgba(167,139,250,0.12)_0%,transparent_65%)]"
      />

      {/* ---------- Page header ---------- */}
      <ShopHeader />

      {unavailable ? (
        <CatalogueUnavailable />
      ) : (
        <ShopCatalog initialFilters={initialFilters} products={products} />
      )}
    </div>
  );
}
