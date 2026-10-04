"use client";

import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/types";

/**
 * Horizontal, snap-scrolling shelf of catalogue tiles — reuses the shop's
 * `ProductCard` so add-to-cart, wishlist and quick view behave identically.
 */
export function RecommendedRail({ products }: { products: readonly Product[] }) {
  if (products.length === 0) return null;

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {products.map((product, index) => (
        <div key={product.id} className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[31%]">
          <ProductCard product={product} index={index} />
        </div>
      ))}
    </div>
  );
}
