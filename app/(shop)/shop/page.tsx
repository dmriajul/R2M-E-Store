import type { Metadata } from "next";
import { ShopCatalog } from "@/components/shop/ShopCatalog";
import { filtersFromSearchParams } from "@/lib/shop";
import { SITE } from "@/lib/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/lib/seo";
import { getCatalogue, isCatalogueOutage } from "@/lib/data/products";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { CatalogueUnavailable } from "@/components/shop/CatalogueUnavailable";

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

  // Three distinct situations, three distinct surfaces:
  //
  //   ready / empty / unconfigured → the catalogue layout (header, filters,
  //                                  grid) with either products or the premium
  //                                  empty state inside it;
  //   unavailable                  → maintenance notice — the *only* state
  //                                  that is allowed to say "we'll be back".
  //
  // `getCatalogue` never throws for the two failure states, so a fresh deploy
  // with no DATABASE_URL renders a beautiful storefront shell instead of the
  // error boundary.
  const { products, status } = await getCatalogue();

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

      {isCatalogueOutage(status) ? (
        <CatalogueUnavailable />
      ) : (
        <ShopCatalog
          initialFilters={initialFilters}
          products={products}
          catalogueStatus={
            status === "unconfigured" ? "unconfigured" : products.length > 0 ? "ready" : "empty"
          }
        />
      )}
    </div>
  );
}
