import type { Metadata } from "next";
import { MotionConfig } from "framer-motion";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { FEATURES } from "@/lib/config";
import { listProducts } from "@/lib/data/products";
import { getHeroSettings } from "@/lib/data/hero-settings";
/* Section imports below are kept in render order (top → bottom) so the import
   block doubles as a table of contents for the page. */
import { HeroSection } from "@/components/sections/HeroSection";
import { VirtualBoutique } from "@/components/sections/VirtualBoutique";
import { BrandMarquee } from "@/components/sections/BrandMarquee";
import { ShopByCategory } from "@/components/sections/ShopByCategory";
import { FeaturedProducts } from "@/components/sections/FeaturedProducts";
import { StatsSection } from "@/components/sections/StatsSection";
import { NewsletterForm } from "@/components/layout/NewsletterForm";
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
 * Render order (top → bottom):
 *   1. <HeroSection />      — owns the viewport
 *   2. <BrandMarquee />     — "Brand values" ticker
 *   3. <ShopByCategory />   — #collections, now ABOVE the product rows
 *   4. <FeaturedProducts /> — #featured, #new-arrivals, #best-sellers
 *   5. <StatsSection />     — #stats (counters + Inner Circle signup)
 *   6. <NewsletterForm />   — moved here out of <Footer />
 *   …then <Footer />, which lives in app/(shop)/layout.tsx and stays last.
 *
 * Vertical rhythm: ShopByCategory, FeaturedProducts and StatsSection each ship
 * their own `py-24 lg:py-32` internally, so the gaps between them are already
 * uniform — no wrapper spacing is added on top, which would double them up.
 * <NewsletterForm /> has no gutter of its own, so its wrapper supplies the same
 * frame (see the comment at the render site).
 *
 * Two surfaces are parked behind flags in `FEATURES` (lib/config.ts) and are
 * therefore not rendered right now:
 *   • <WelcomeOverlay />  — the session intro overlay
 *   • <VirtualBoutique /> — the scroll-driven showcase that used to sit
 *                           between the hero and the brand marquee
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

        <BrandMarquee />

        <Reveal>
          <ShopByCategory />
        </Reveal>

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
          <StatsSection />
        </Reveal>

        <Reveal>
          {/* NewsletterForm renders a bare <form> with no gutter of its own, so
              the wrapper supplies the same max-width / horizontal padding /
              vertical rhythm the sibling sections carry internally. */}
          <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
            <NewsletterForm />
          </div>
        </Reveal>
      </main>
    </MotionConfig>
  );
}
