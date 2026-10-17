import { listProducts } from "@/lib/data/products";
import { ProductCard } from "@/components/product/ProductCard";
import { CatalogueEmptyState } from "@/components/sections/CatalogueEmptyState";
import { Reveal } from "@/components/sections/Reveal";
import { SectionHeading } from "@/components/sections/SectionHeading";
import type { Product } from "@/types";

/** Stagger between grid cards: ~70ms, per the animation rules. */
const CARD_STAGGER_S = 0.07;

/**
 * New Arrivals — responsive product grid (Server Component).
 *
 * Why server: nothing here needs a browser. The query runs on the server, the
 * cards are plain markup, and the only client-side piece is <ProductCard />
 * itself (cart + wishlist stores). Keeping the section on the server means the
 * product data never ships as JSON in the RSC payload — only the rendered HTML
 * does.
 *
 * Data: the 8 most recently added active products, via the `sort: "newest"`
 * option on `listProducts`. We deliberately sort by `createdAt` rather than
 * filtering on the `newArrival` flag, because the flag is opt-in per product
 * and is easy to leave unticked — a date sort always yields a full grid.
 *
 * Layout: 2-up on phones, 3-up on tablets, 4-up from `lg` (1024px). Cards are
 * stretched to equal height so titles and prices line up across each row.
 *
 * Performance: the first 4 cards are above the fold on desktop, so they get
 * `priority` (preloaded, eager). The rest lazy-load.
 */
export async function NewArrivalsGrid() {
  const { products, catalogueAvailable } = await listProducts({
    sort: "newest",
    limit: 8,
  }).then(
    (result) => ({ ...result, catalogueAvailable: true }),
    (error: unknown) => {
      // An unreachable catalogue collapses this section; the home page's
      // maintenance notice (if any) is owned by the page itself.
      if (error instanceof Error && error.name === "DatabaseUnavailableError") {
        return {
          products: [] as Product[],
          source: "database" as const,
          catalogueAvailable: false,
        };
      }
      throw error;
    },
  );

  /** Outage — collapse; the page-level maintenance notice explains why. */
  if (!catalogueAvailable) return null;

  return (
    <section
      id="new-arrivals"
      aria-labelledby="new-arrivals-title"
      className="relative py-24 lg:py-32"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            id="new-arrivals-title"
            eyebrowKey="sections.newArrivalsEyebrow"
            titleKey="sections.newArrivals"
            descriptionKey="sections.newArrivalsDescription"
          />
        </Reveal>

        {/* `items-stretch` (the grid default) + `h-full` on each card keeps
            every tile in a row the same height, so the bottom-anchored price
            and CTA align even when names or meta rows differ in length.

            Each card gets its own <Reveal /> with a 70ms step. The cards carry
            no animation of their own, so this is the only thing moving them —
            no double animation, and nothing plays off-screen. */}
        {products.length === 0 ? (
          /* Reachable catalogue, nothing in it yet — keep the section's
             layout and say so, instead of leaving a hole in the page. */
          <CatalogueEmptyState />
        ) : (
          <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product, index) => (
              <Reveal
                key={product.id}
                delay={index * CARD_STAGGER_S}
                className="h-full"
              >
                <ProductCard
                  product={product}
                  priority={index < 4}
                  className="h-full"
                />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
