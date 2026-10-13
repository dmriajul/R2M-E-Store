import type { Metadata } from "next";
import { MotionConfig } from "framer-motion";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { listProducts } from "@/lib/data/products";
import { getHeroSettings } from "@/lib/data/hero-settings";
import { HeroSection } from "@/components/sections/HeroSection";
import { VirtualBoutique } from "@/components/sections/VirtualBoutique";
import { BrandMarquee } from "@/components/sections/BrandMarquee";
import { FeaturedProducts } from "@/components/sections/FeaturedProducts";
import { ShopByCategory } from "@/components/sections/ShopByCategory";
import { getShopCategoryCounts } from "@/lib/data/shop-categories";
import { StatsSection } from "@/components/sections/StatsSection";
import { Reveal } from "@/components/sections/Reveal";
import { WelcomeOverlay } from "@/components/ui/WelcomeOverlay";

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
 */
export default async function HomePage() {
  const [
    heroSettings,
    virtualBoutique,
    featured,
    newArrivals,
    bestSellers,
    categoryCounts,
  ] = await Promise.all([
    getHeroSettings(),
    listProducts({ placement: "virtualBoutique", limit: 3 }),
    listProducts({ featured: true, limit: 4 }),
    listProducts({ placement: "newArrival", limit: 4 }),
    listProducts({ placement: "bestSeller", limit: 4 }),
    getShopCategoryCounts(),
  ]);
  return (
    /* reducedMotion="user" makes framer-motion honour prefers-reduced-motion
       globally: transform/layout animations are skipped and snapped to their
       end value while opacity still fades. */
    <MotionConfig reducedMotion="user">
      {/* Organization schema — one per site, rendered on the home page. */}
      <JsonLd id="organization-schema" data={organizationSchema()} />
      <WelcomeOverlay />

      <main className="w-full overflow-x-clip">
        <HeroSection settings={heroSettings} />

        <VirtualBoutique products={virtualBoutique.products} />

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
          <ShopByCategory counts={categoryCounts} />
        </Reveal>

        <Reveal>
          <StatsSection />
        </Reveal>

        <BrandMarquee />
      </main>
    </MotionConfig>
  );
}
