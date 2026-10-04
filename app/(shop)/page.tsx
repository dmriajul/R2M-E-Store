import type { Metadata } from "next";
import { MotionConfig } from "framer-motion";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { HeroSection } from "@/components/sections/HeroSection";
import { BrandMarquee } from "@/components/sections/BrandMarquee";
import { FeaturedProducts } from "@/components/sections/FeaturedProducts";
import { CollectionsGrid } from "@/components/sections/CollectionsGrid";
import { StatsSection } from "@/components/sections/StatsSection";
import { Reveal } from "@/components/sections/Reveal";

export const metadata: Metadata = {
  title: { absolute: "Little Luxe — Premium Kids Fashion" },
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Little Luxe — Premium Kids Fashion",
    description: SITE.description,
    url: SITE.url,
    type: "website",
  },
};

/**
 * Home page. The hero owns the viewport; every section below is staged into
 * view by <Reveal />. Section ids double as in-page scroll anchors
 * (`#featured`, `#collections`, `#stats`), and `scroll-padding-top` in
 * globals.css keeps the sticky navbar from covering them on jump.
 */
export default function HomePage() {
  return (
    /* reducedMotion="user" makes framer-motion honour prefers-reduced-motion
       globally: transform/layout animations are skipped and snapped to their
       end value while opacity still fades. */
    <MotionConfig reducedMotion="user">
      {/* Organization schema — one per site, rendered on the home page. */}
      <JsonLd id="organization-schema" data={organizationSchema()} />

      <HeroSection />

      <BrandMarquee />

      <Reveal>
        <FeaturedProducts />
      </Reveal>

      <Reveal>
        <CollectionsGrid />
      </Reveal>

      <Reveal>
        <StatsSection />
      </Reveal>
    </MotionConfig>
  );
}
