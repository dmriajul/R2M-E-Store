import { unstable_cache } from "next/cache";
import { SHOP_CATEGORIES } from "@/lib/config";
import { getPrisma } from "@/lib/prisma";
import { PRODUCTS } from "@/lib/site";
import type { ProductCategory } from "@/types";

export type ShopCategorySlug = (typeof SHOP_CATEGORIES)[number]["slug"];
export type ShopCategoryCounts = Record<ShopCategorySlug, number>;

function countMockProducts(): ShopCategoryCounts {
  const counts = Object.fromEntries(
    SHOP_CATEGORIES.map((category) => [category.slug, 0]),
  ) as ShopCategoryCounts;

  for (const product of PRODUCTS) {
    if (product.status !== "active") continue;

    const assigned = new Set<ProductCategory>([
      product.category,
      ...(product.categories ?? []),
    ]);

    for (const category of SHOP_CATEGORIES) {
      if (category.productCategories.some((value) => assigned.has(value))) {
        counts[category.slug] += 1;
      }
    }
  }

  return counts;
}

async function loadShopCategoryCounts(): Promise<ShopCategoryCounts> {
  const fallback = countMockProducts();
  const db = await getPrisma();
  if (!db) return fallback;

  try {
    const entries = await Promise.all(
      SHOP_CATEGORIES.map(async (category) => {
        const productCategories = [...category.productCategories];
        const count = await db.product.count({
          where: {
            active: true,
            OR: [
              { category: { in: productCategories } },
              { categories: { hasSome: productCategories } },
            ],
          },
        });
        return [category.slug, count] as const;
      }),
    );

    return Object.fromEntries(entries) as ShopCategoryCounts;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[shop-categories] count query failed — serving mock counts:",
        error instanceof Error ? error.message : error,
      );
    }
    return fallback;
  }
}

/**
 * Product counts are computed from active database rows (including both the
 * primary category and legacy `categories` array) and revalidated hourly.
 * The demo catalogue keeps the same storefront functional without Postgres.
 */
const getCachedShopCategoryCounts = unstable_cache(
  loadShopCategoryCounts,
  ["mukra-shop-category-counts-v1"],
  { revalidate: 3600, tags: ["shop-category-counts"] },
);

export function getShopCategoryCounts(): Promise<ShopCategoryCounts> {
  return getCachedShopCategoryCounts();
}
