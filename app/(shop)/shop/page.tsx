import type { Metadata } from "next";
import { ShopCatalog } from "@/components/shop/ShopCatalog";
import { filtersFromSearchParams } from "@/lib/shop";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Kids Fashion | LITTLE LUXE" },
  description:
    "Shop the LITTLE LUXE kids collection — organic cotton dresses, tees, bottoms, shoes, outerwear and accessories for ages 0–14. Free shipping over $50 and 30-day easy returns.",
  keywords: [
    "kids fashion",
    "children's clothing",
    "organic kids clothes",
    "toddler outfits",
    "kids shoes",
    "baby clothes",
  ],
  openGraph: {
    title: "Kids Fashion | LITTLE LUXE",
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

  return (
    <div className="relative">
      {/* Soft, warm ambience for the kids line. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(90%_100%_at_15%_0%,rgba(244,114,182,0.14)_0%,transparent_60%),radial-gradient(70%_90%_at_85%_10%,rgba(167,139,250,0.12)_0%,transparent_65%)]"
      />

      {/* ---------- Page header ---------- */}
      <header className="relative mx-auto w-full max-w-7xl px-4 pt-14 pb-8 sm:px-6 lg:px-8 lg:pt-20">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
          <p className="text-xs font-semibold tracking-[0.3em] text-lavender uppercase">
            {SITE.kidsBrand}
          </p>
          <h1 className="mt-4 text-5xl font-bold tracking-tight text-white sm:text-6xl">
            Kids Collection
          </h1>
          <span
            aria-hidden
            className="mt-5 block h-1 w-24 rounded-full bg-linear-to-r from-primary via-rose to-lavender"
          />
          <p className="prose-kids mt-5 max-w-xl text-lg text-muted-foreground">
            {SITE.kidsTagline}
          </p>
        </div>
      </header>

      <ShopCatalog initialFilters={initialFilters} />
    </div>
  );
}
