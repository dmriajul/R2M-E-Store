import { listProducts } from "@/lib/data/products";
import { ProductCard } from "@/components/product/ProductCard";
import { SectionHeading } from "@/components/sections/SectionHeading";

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
  const { products } = await listProducts({ sort: "newest", limit: 8 });

  /** Nothing to show — collapse the section instead of leaving a gap. */
  if (products.length === 0) return null;

  return (
    <section
      id="new-arrivals"
      aria-labelledby="new-arrivals-title"
      className="relative py-24 lg:py-32"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="new-arrivals-title"
          eyebrowKey="sections.newArrivalsEyebrow"
          titleKey="sections.newArrivals"
          descriptionKey="sections.newArrivalsDescription"
        />

        {/* `items-stretch` (the grid default) + `h-full` on each card keeps
            every tile in a row the same height, so the bottom-anchored price
            and CTA align even when names or meta rows differ in length. */}
        <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              priority={index < 4}
              className="h-full"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
