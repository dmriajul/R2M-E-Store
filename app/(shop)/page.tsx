import type { Metadata } from "next";
import { MotionConfig } from "framer-motion";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { FEATURES } from "@/lib/config";
import { getCatalogue } from "@/lib/data/products";
import { getCategoryImageMap } from "@/lib/data/categories";
import { getHeroSettings } from "@/lib/data/hero-settings";
import { CatalogueUnavailable } from "@/components/shop/CatalogueUnavailable";
/* Section imports below are kept in render order (top → bottom) so the import
   block doubles as a table of contents for the page. */
import { HeroSection } from "@/components/sections/HeroSection";
import { VirtualBoutique } from "@/components/sections/VirtualBoutique";
import { BrandMarquee } from "@/components/sections/BrandMarquee";
import { ShopByCategory } from "@/components/sections/ShopByCategory";
import { NewArrivalsGrid } from "@/components/sections/NewArrivalsGrid";
import { CampaignBanner } from "@/components/sections/CampaignBanner";
import { FeaturedCarousel } from "@/components/sections/FeaturedCarousel";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
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
 *   1. <HeroSection />      — owns the viewport; always rendered (CSS entrance)
 *   2. <BrandMarquee />     — "Brand values" ticker
 *   3. <ShopByCategory />   — #collections carousel (static tiles + photos)
 *   4. <NewArrivalsGrid />  — #new-arrivals, 8 latest products (2/3/4-up grid)
 *                             or the premium "being curated" panel
 *   5. <CampaignBanner />   — full-bleed "The Winter Edit" campaign
 *   6. <FeaturedCarousel /> — #featured, Embla rail (only when featured rows
 *                             exist — an empty rail would repeat the panel above)
 *   7. <FeaturesSection />  — #features + #stats, the always-rendered trust band
 *   …then the single <NewsletterSection /> and <Footer /> from the shop layout.
 *
 * Empty-catalogue contract (0 products in the database):
 *   • Hero, brand marquee, category tiles, campaign banner and the features
 *     band ALWAYS render their full layout — none of them is data-driven.
 *   • <NewArrivalsGrid /> keeps its heading and swaps the grid for a premium
 *     empty state; the featured rail stays out of the way.
 *   • Only an *unreachable* database (configured but failing) shows the
 *     <CatalogueUnavailable /> maintenance notice. A deployment without
 *     DATABASE_URL is treated as "opening soon" — never as an outage.
 *
 * Vertical rhythm: every section owns the same token — `py-16 lg:py-20`
 * (the banner puts it on its inner content frame so it can stay edge-to-edge).
 * Adjacent sections therefore share one gap of 128px/160px instead of stacking
 * two 128px/192px paddings into a 256px/384px void, and no wrapper spacing is
 * added here.
 *
 * Two surfaces are parked behind flags in `FEATURES` (lib/config.ts) and are
 * therefore not rendered right now:
 *   • <WelcomeOverlay />  — the session intro overlay
 *   • <VirtualBoutique /> — the scroll-driven showcase that used to sit
 *                           between the hero and the brand marquee
 */
export default async function HomePage() {
  const [heroSettings, virtualBoutique, featured, categoryImages, catalogue] =
    await Promise.all([
      getHeroSettings(),
      // Skip the query entirely while the Virtual Boutique is hidden — there is
      // no point paying for a round-trip whose results nothing renders.
      FEATURES.virtualBoutique
        ? getCatalogue({ placement: "virtualBoutique", limit: 8 })
        : Promise.resolve({ products: [] as Product[], status: "empty" as const }),
      // Curated rail. 8 rather than 4 so the carousel still has something to
      // scroll at 3-up on desktop once more products get flagged. <NewArrivalsGrid />
      // fetches its own data server-side, so it is not queried here.
      getCatalogue({ featured: true, limit: 8 }),
      // Category covers uploaded in the console ({} in fallback mode / on error).
      getCategoryImageMap(),
      // Cheap probe: is the catalogue reachable at all? Drives whether the
      // maintenance notice replaces the product sections.
      getCatalogue({ limit: 1 }),
    ]);

  const catalogueUnavailable = catalogue.status === "unavailable";
  const hasFeatured = featured.status === "ready" && featured.products.length > 0;

  return (
    /* reducedMotion="user" makes framer-motion honour prefers-reduced-motion
       globally: transform/layout animations are skipped and snapped to their
       end value while opacity still fades. */
    <MotionConfig reducedMotion="user">
      {/* Organization schema — one per site, rendered on the home page. */}
      <JsonLd id="organization-schema" data={organizationSchema()} />

      {/* Welcome intro overlay — hidden, see FEATURES.welcomeOverlay. */}
      {FEATURES.welcomeOverlay ? <WelcomeOverlay /> : null}

      {/* The shop layout already owns <main id="main-content">; this is the
          page's own clipping wrapper (overflow-x-clip contains the marquee). */}
      <div className="w-full overflow-x-clip">
        <HeroSection settings={heroSettings} />

        {/* Virtual Boutique showcase — hidden, see FEATURES.virtualBoutique. */}
        {FEATURES.virtualBoutique ? (
          <VirtualBoutique products={virtualBoutique.products} />
        ) : null}

        <BrandMarquee />

        <Reveal>
          <ShopByCategory images={categoryImages} />
        </Reveal>

        {/* New Arrivals — server-rendered grid. It owns its own <Reveal>s so
            the cards can stagger; an outer wrapper here would double-animate.
            With an empty catalogue it keeps the section and shows the premium
            empty state; with an unreachable one it renders nothing. */}
        <NewArrivalsGrid />

        {/* Catalogue unreachable — an honest notice, never sample products.
            Sits exactly where the product sections would have been. */}
        {catalogueUnavailable && <CatalogueUnavailable variant="section" />}

        {/* Editorial campaign banner — full-bleed, between grid and rail.
            Its copy lines stagger internally. */}
        <CampaignBanner />

        {/* Curated rail — Embla, manual navigation only. Rendered only when
            there are featured pieces; otherwise the empty panel in New Arrivals
            already tells the story and a second one would just add height. */}
        {hasFeatured && (
          <Reveal>
            <FeaturedCarousel products={featured.products} />
          </Reveal>
        )}

        {/* Why-Mukra trust band + stats — always rendered, layout and all. */}
        <FeaturesSection />
      </div>
    </MotionConfig>
  );
}
