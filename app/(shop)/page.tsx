import type { Metadata } from "next";
import { MotionConfig } from "framer-motion";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { FEATURES } from "@/lib/config";
import { listProducts } from "@/lib/data/products";
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
 *   5. <CampaignBanner />   — full-bleed "The Winter Edit" campaign
 *   6. <FeaturedCarousel /> — #featured, Embla rail (manual only)
 *   7. <FeaturesSection />  — #features + #stats, the always-rendered trust band
 *   …then the single <NewsletterSection /> and <Footer /> from the shop layout.
 *
 * Empty-catalogue contract (0 products in the database):
 *   • Hero, brand marquee, category tiles, campaign banner and the features
 *     band ALWAYS render their full layout — none of them is data-driven.
 *   • The two product surfaces (<NewArrivalsGrid />, <FeaturedCarousel />)
 *     keep their headings and swap the grid/rail for a premium empty state.
 *   • Only an *unreachable* database collapses those two sections in favour
 *     of the <CatalogueUnavailable /> maintenance notice.
 *
 * Vertical rhythm: every section ships its own `py-24 lg:py-32` (the banner
 * puts the token on its inner content frame so it can stay edge-to-edge), so
 * the gaps between them are already uniform — no wrapper spacing is added on
 * top, which would double them up. NewsletterSection is rendered once from
 * app/(shop)/layout.tsx across storefront routes.
 *
 * Data: the page only fetches what the client rail needs (`featured`). The grid
 * fetches its own 8 newest products inside <NewArrivalsGrid />, so that query
 * stays next to the markup that renders it.
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
  // The catalogue comes from the database only. When it cannot be reached the
  // product sections collapse and a maintenance notice explains why — the home
  // page never falls back to baked-in sample products.
  const catalogueUnavailable = (error: unknown): boolean =>
    error instanceof Error && error.name === "DatabaseUnavailableError";

  const [heroSettings, virtualBoutique, featured, categoryImages, unavailable] =
    await Promise.all([
      getHeroSettings(),
      // Skip the query entirely while the Virtual Boutique is hidden — there is
      // no point paying for a round-trip whose results nothing renders.
      FEATURES.virtualBoutique
        ? listProducts({ placement: "virtualBoutique", limit: 8 }).catch((error: unknown) => {
            if (!catalogueUnavailable(error)) throw error;
            return { products: [] as Product[], source: "database" as const };
          })
        : Promise.resolve({ products: [] as Product[], source: "database" as const }),
      // Curated rail. 8 rather than 4 so the carousel still has something to
      // scroll at 3-up on desktop once more products get flagged. <NewArrivalsGrid />
      // fetches its own data server-side, so it is not queried here.
      listProducts({ featured: true, limit: 8 }).catch((error: unknown) => {
        if (!catalogueUnavailable(error)) throw error;
        return { products: [] as Product[], source: "database" as const };
      }),
      // Category covers uploaded in the console ({} in fallback mode / on error).
      getCategoryImageMap(),
      listProducts({ limit: 1 })
        .then(() => false)
        .catch((error: unknown) => {
          if (!catalogueUnavailable(error)) throw error;
          return true;
        }),
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
            the cards can stagger; an outer wrapper here would double-animate. */}
        <NewArrivalsGrid />

        {/* Editorial campaign banner — full-bleed, between grid and rail.
            Its copy lines stagger internally. */}
        <CampaignBanner />

        {/* Curated rail — Embla, manual navigation only. Skipped entirely
            while the catalogue is unreachable (the maintenance notice below
            owns that message); an empty-but-reachable catalogue gets the
            rail's own premium empty state. */}
        {!unavailable && (
          <Reveal>
            <FeaturedCarousel products={featured.products} />
          </Reveal>
        )}

        {/* Catalogue unreachable — an honest notice, never sample products. */}
        {unavailable && <CatalogueUnavailable />}

        {/* Why-Mukra trust band + stats — always rendered, layout and all. */}
        <FeaturesSection />

      </div>
    </MotionConfig>
  );
}
