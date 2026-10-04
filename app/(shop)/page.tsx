import type { Metadata } from "next";
import { MotionConfig } from "framer-motion";
import { HeroSection } from "@/components/sections/HeroSection";
import { BrandMarquee } from "@/components/sections/BrandMarquee";
import { FeaturedProducts } from "@/components/sections/FeaturedProducts";
import { CollectionsGrid } from "@/components/sections/CollectionsGrid";
import { StatsSection } from "@/components/sections/StatsSection";
import { Reveal } from "@/components/sections/Reveal";

export const metadata: Metadata = {
  title: "Home",
  description:
    "LUXE — modern luxury, considered. Timepieces, jewelry and accessories for people who prefer to own less, better.",
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
