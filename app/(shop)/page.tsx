import type { Metadata } from "next";
import { MotionConfig } from "framer-motion";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { FEATURES } from "@/lib/config";
import { listProducts } from "@/lib/data/products";
import { getHeroSettings } from "@/lib/data/hero-settings";
import { HeroSection } from "@/components/sections/HeroSection";
import { VirtualBoutique } from "@/components/sections/VirtualBoutique";
import { BrandMarquee } from "@/components/sections/BrandMarquee";
import { FeaturedProducts } from "@/components/sections/FeaturedProducts";
import { ShopByCategory } from "@/components/sections/ShopByCategory";
import { StatsSection } from "@/components/sections/StatsSection";
import { Reveal } from "@/components/sections/Reveal";
import { WelcomeOverlay } from "@/components/ui/WelcomeOverlay";
import type { Product } from "@/types";

export const metadata: Metadata = {
  title: { absolute: "Mukra — Premium Kids Fashion" },
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Mukra — Premium Kids Fashion",
    description: SITE.description,
    url: SITE.url,
    type: "website",
  },
};

export const dynamic = "force-dynamic";

/**
 * Home page. The hero owns the viewport; every section below is staged into
 * view by <Reveal />. Section ids double as in-page scroll anchors
 * (`#featured`, `#collections`, `#stats`), and `scroll-padding-top` in
 * globals.css keeps the sticky navbar from covering them on jump.
 *
 * Two surfaces are parked behind flags in `FEATURES` (lib/config.ts) and are
 * therefore not rendered right now:
 *   • <WelcomeOverlay />  — the session intro overlay
 *   • <VirtualBoutique /> — the scroll-driven showcase that used to sit
 *                           between the hero and the featured grid
 * Their component files are untouched; set the flags to `true` to bring them
 * back. Nothing else on the page depends on them, so removing them leaves no
 * gap: the overlay was `position: fixed` (out of flow) and the boutique was a
 * self-contained <section> whose height went with it.
 */
export default async function HomePage() {
  const [heroSettings, virtualBoutique, featured, newArrivals, bestSellers] = await Promise.all([
    getHeroSettings(),
    // Skip the query entirely while the Virtual Boutique is hidden — there is
    // no point paying for a round-trip whose results nothing renders.
    FEATURES.virtualBoutique
      ? listProducts({ placement: "virtualBoutique", limit: 3 })
      : Promise.resolve({ products: [] as Product[], source: "mock" as const }),
    listProducts({ featured: true, limit: 4 }),
    listProducts({ placement: "newArrival", limit: 4 }),
    listProducts({ placement: "bestSeller", limit: 4 }),
  ]);
  return (
    /* reducedMotion="user" makes framer-motion honour prefers-reduced-motion
       globally: transform/layout animations are skipped and snapped to their
       end value while opacity still fades. */
    <MotionConfig reducedMotion="user">
      {/* Organization schema — one per site, rendered on the home page. */}
      <JsonLd id="organization-schema" data={organizationSchema()} />

      {/* Welcome intro overlay — hidden, see FEATURES.welcomeOverlay. */}
      {FEATURES.welcomeOverlay ? <WelcomeOverlay /> : null}

      <main className="w-full overflow-x-clip">
        <HeroSection settings={heroSettings} />

        {/* Virtual Boutique showcase — hidden, see FEATURES.virtualBoutique. */}
        {FEATURES.virtualBoutique ? (
          <VirtualBoutique products={virtualBoutique.products} />
        ) : null}

        <Reveal>
          <FeaturedProducts products={featured.products} />
        </Reveal>

        <Reveal>
          <FeaturedProducts
            id="new-arrivals"
            eyebrow="Just Landed"
            title="New Arrivals"
            description="Discover the latest pieces added to the MUKRA collection."
            products={newArrivals.products}
          />
        </Reveal>

        <Reveal>
          <FeaturedProducts
            id="best-sellers"
            eyebrow="Loved by Families"
            title="Best Sellers"
            description="Explore the pieces families keep coming back for."
            products={bestSellers.products}
          />
        </Reveal>

        <Reveal>
          <ShopByCategory />
        </Reveal>

        <Reveal>
          <StatsSection />
        </Reveal>

        <BrandMarquee />
      </main>
    </MotionConfig>
  );
}
