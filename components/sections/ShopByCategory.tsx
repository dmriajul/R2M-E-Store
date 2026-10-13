import { listProducts } from "@/lib/data/products";
import { ShopByCategoryCarousel } from "@/components/sections/ShopByCategoryCarousel";
import type { Product, ProductCategory } from "@/types";

interface CategoryDefinition {
  /** File basename under `/public/images/categories/`. */
  image: string;
  /** English category name; the carousel translates it at render time. */
  label: string;
  /** Existing catalogue URL — keep these query strings stable for SEO. */
  href: string;
  /** Canonical product categories used when tags are not available. */
  productCategories: readonly ProductCategory[];
  /** More specific catalogue tags for editorial groupings. */
  productTags?: readonly string[];
}

const CATEGORY_DEFINITIONS: readonly CategoryDefinition[] = [
  {
    image: "tops-tees",
    label: "Tops & Tees",
    href: "/shop?category=tops-tees",
    productCategories: ["Tops & Tees"],
  },
  {
    image: "pants-bottoms",
    label: "Pants & Bottoms",
    href: "/shop?category=winter-bottoms-trousers",
    productCategories: ["Winter Bottoms / Trousers", "Winter Sets & Tracksuits"],
    productTags: ["bottoms"],
  },
  {
    image: "frocks-dresses",
    label: "Frocks & Dresses",
    href: "/shop?category=frocks-dresses",
    productCategories: ["Winter Sets & Tracksuits"],
    productTags: ["dresses", "dress", "frocks", "frock", "gown"],
  },
  {
    image: "outerwear",
    label: "Outerwear",
    href: "/shop?category=jackets-coats",
    productCategories: ["Jackets & Coats", "Sweatshirts & Hoodies"],
    productTags: ["outerwear", "jacket", "coat", "hoodie"],
  },
  {
    image: "accessories",
    label: "Accessories",
    href: "/shop?category=accessories",
    productCategories: ["Accessories"],
  },
] as const;

function matchesCategory(product: Product, category: CategoryDefinition): boolean {
  // Prefer the merchandising tags for editorial cards when a source provides
  // them; database rows currently fall back to the canonical category fields.
  if (category.productTags?.length && product.tags.length > 0) {
    return category.productTags.some((tag) => product.tags.includes(tag));
  }

  const assignedCategories = [product.category, ...(product.categories ?? [])];
  return category.productCategories.some((name) => assignedCategories.includes(name));
}

/**
 * Server-render the editorial category data from the existing product layer.
 * Embla and its controls live in the small client wrapper; product records do
 * not cross the server/client boundary, only the category labels, counts and
 * existing hrefs do.
 */
export async function ShopByCategory() {
  const { products } = await listProducts({ activeOnly: true });
  const categories = CATEGORY_DEFINITIONS.map((category) => ({
    image: category.image,
    label: category.label,
    href: category.href,
    count: products.filter((product) => matchesCategory(product, category)).length,
  }));

  return (
    <section id="collections" className="relative py-24 lg:py-32">
      <div className="mx-auto w-full min-w-0 max-w-7xl px-4 sm:px-6 lg:px-8">
        <ShopByCategoryCarousel categories={categories} />
      </div>
    </section>
  );
}
