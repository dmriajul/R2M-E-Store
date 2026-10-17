/**
 * Homepage rhythm guard — regression net for the "massive black gap below the
 * stats band" report.
 *
 * The premium layout uses one shared vertical rhythm token, `py-16 lg:py-20`,
 * on every storefront section. The gap returned once already because sections
 * had drifted to `py-24 lg:py-32` (96/128px *per side*), which stacks to
 * 192/256px of empty space between two sections. Two other patterns caused
 * similar holes and must not come back either:
 *
 *   • `min-h-screen` on a section, which stretches a short band to a full
 *     viewport even when it only has a heading and a paragraph;
 *   • a second `<NewsletterSection />` on the home page — the shop layout owns
 *     the single capture, directly above the footer.
 *
 * The hero's `min-h-[100svh]` is deliberate (it owns the viewport), and the
 * campaign banner's bounded `min-h-[20rem]`/`28rem` is allowed, so this test
 * checks for the *screen-height* and *extra-large padding* classes, not for
 * every min-height utility.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

/** Sections rendered on `/`, in order, plus the shop chrome around them. */
const HOMEPAGE_SOURCES = [
  "app/(shop)/page.tsx",
  "components/sections/HeroSection.tsx",
  "components/sections/BrandMarquee.tsx",
  "components/sections/ShopByCategory.tsx",
  "components/sections/NewArrivalsGrid.tsx",
  "components/sections/CampaignBanner.tsx",
  "components/sections/FeaturedCarousel.tsx",
  "components/sections/FeaturesSection.tsx",
  "components/sections/NewsletterSection.tsx",
] as const;

/** Classes that previously produced the void. */
const BANNED_SPACING = [
  { pattern: /\bmin-h-screen\b/, why: "stretches a band to a full viewport" },
  { pattern: /\bpy-(24|28|32|36|40|44|48)\b/, why: "doubles the section rhythm" },
  { pattern: /\b(mt|mb|pt|pb|my)-(32|36|40|44|48)\b/, why: "stacks extra space around a section" },
] as const;

/**
 * The hero owns a full viewport by design (`min-h-[100svh]`) and pads its
 * content generously inside it. It is the one intentional exception; every
 * other band must stay on the shared token.
 */
const HERO = "components/sections/HeroSection.tsx";

test("homepage sections keep the single tight rhythm token", async () => {
  for (const file of HOMEPAGE_SOURCES) {
    const source = await readFile(file, "utf8");

    assert.doesNotMatch(
      source,
      BANNED_SPACING[0].pattern,
      `${file} reintroduces min-h-screen (stretches a band to a full viewport)`,
    );

    if (file === HERO) continue;

    for (const { pattern, why } of BANNED_SPACING.slice(1)) {
      assert.doesNotMatch(
        source,
        pattern,
        `${file} reintroduces ${pattern} (${why}); use py-16 lg:py-20 instead`,
      );
    }
  }
});

test("every storefront section that owns padding uses py-16 lg:py-20", async () => {
  // The banner puts the token on its inner content frame so it can stay
  // full-bleed; every other section carries it on the <section> wrapper.
  const padded = [
    "components/sections/ShopByCategory.tsx",
    "components/sections/NewArrivalsGrid.tsx",
    "components/sections/CampaignBanner.tsx",
    "components/sections/FeaturesSection.tsx",
    "components/sections/NewsletterSection.tsx",
  ] as const;

  for (const file of padded) {
    const source = await readFile(file, "utf8");
    assert.match(source, /py-16 lg:py-20/, `${file} must use the shared rhythm token`);
  }
});

test("the newsletter capture is rendered once, by the shop layout", async () => {
  const layout = await readFile("app/(shop)/layout.tsx", "utf8");
  const home = await readFile("app/(shop)/page.tsx", "utf8");

  assert.equal(
    layout.match(/<NewsletterSection\s*\/>/g)?.length,
    1,
    "the shop layout must render exactly one newsletter capture",
  );
  assert.doesNotMatch(
    home,
    /<NewsletterSection\b/,
    "the home page must not render a second newsletter capture",
  );
});
