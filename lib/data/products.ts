/**
 * Products data layer.
 *
 * Queries Postgres through Prisma when `DATABASE_URL` is set, and falls back to
 * the mock catalogue in `lib/site.ts` otherwise — every call resolves, so the
 * storefront never sees an error state it can't render.
 */

import { CATEGORY_META, COLOR_HEX, DEFAULT_SWATCH, PRODUCTS, getProductById } from "@/lib/site";
import { withDatabase } from "@/lib/prisma";
import type { Product, ProductBadge, ProductCategory, ProductGender } from "@/types";

/** The row shape we read back from Postgres. */
export interface ProductRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  originalPrice: number | null;
  category: string;
  gender: string;
  ageRange: string;
  material: string | null;
  colors: string[];
  sizes: string[];
  images: string[];
  modelColor: string | null;
  stock: number;
  badge: string | null;
  featured: boolean;
  active: boolean;
  createdAt?: Date | string;
}

const CATEGORIES = Object.keys(CATEGORY_META) as ProductCategory[];

export function toProductCategory(value: string): ProductCategory {
  return CATEGORIES.includes(value as ProductCategory) ? (value as ProductCategory) : "Accessories";
}

function toGender(value: string): ProductGender {
  return value === "Boys" || value === "Unisex" ? value : "Girls";
}

/** Database row → storefront `Product`. */
export function rowToProduct(row: ProductRow): Product {
  const category = toProductCategory(row.category);
  const firstColor = row.colors[0] ?? "Pink";
  const images =
    row.images.length > 0 ? row.images : [`${row.slug}-1`, `${row.slug}-2`, `${row.slug}-3`];

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.description.slice(0, 96),
    description: row.description,
    price: row.price,
    originalPrice: row.originalPrice ?? undefined,
    compareAtPrice: row.originalPrice ?? undefined,
    currency: "USD",
    images,
    category,
    ageRange: row.ageRange,
    gender: toGender(row.gender),
    colors: row.colors,
    sizes: row.sizes,
    material: row.material ?? "Organic cotton",
    badge: (row.badge as ProductBadge | null) ?? undefined,
    modelColor: row.modelColor ?? COLOR_HEX[firstColor] ?? DEFAULT_SWATCH,
    tags: [],
    rating: 5,
    reviewCount: 0,
    stock: row.stock,
    inStock: row.stock > 0 && row.active,
    featured: row.featured,
    status: row.active ? "active" : "draft",
    createdAt:
      typeof row.createdAt === "string"
        ? row.createdAt
        : (row.createdAt?.toISOString() ?? new Date().toISOString()),
  } as Product;
}

export interface ProductQuery {
  category?: string;
  featured?: boolean;
  activeOnly?: boolean;
}

/** Catalogue listing. Fallback: the 12 seeded mock products. */
export async function listProducts(
  query: ProductQuery = {},
): Promise<{ products: Product[]; source: "database" | "mock" }> {
  const { data, source } = await withDatabase<Product[]>(
    async (db) => {
      const rows = (await db.product.findMany({
        where: {
          ...(query.category ? { category: query.category } : {}),
          ...(query.featured ? { featured: true } : {}),
          ...(query.activeOnly === false ? {} : { active: true }),
        },
        orderBy: { createdAt: "asc" },
      })) as ProductRow[];

      return rows.map(rowToProduct);
    },
    () =>
      PRODUCTS.filter(
        (product) =>
          (!query.category || product.category === query.category) &&
          (!query.featured || product.featured) &&
          (query.activeOnly === false || product.status === "active"),
      ),
  );

  return { products: data, source };
}

/** Single product by slug **or** id (the mock catalogue keys on id). */
export async function findProduct(identifier: string): Promise<{
  product: Product | null;
  source: "database" | "mock";
}> {
  const { data, source } = await withDatabase<Product | null>(
    async (db) => {
      const row = (await db.product.findFirst({
        where: { OR: [{ slug: identifier }, { id: identifier }] },
      })) as ProductRow | null;
      return row ? rowToProduct(row) : null;
    },
    () => getProductById(identifier) ?? null,
  );

  return { product: data, source };
}

/** Stock lookup used by the order API to re-price lines. */
export async function findProductsByIds(ids: readonly string[]): Promise<{
  products: Product[];
  source: "database" | "mock";
}> {
  const unique = Array.from(new Set(ids));

  const { data, source } = await withDatabase<Product[]>(
    async (db) => {
      const rows = (await db.product.findMany({ where: { id: { in: unique } } })) as ProductRow[];
      return rows.map(rowToProduct);
    },
    () =>
      unique
        .map((id) => getProductById(id))
        .filter((product): product is Product => Boolean(product)),
  );

  return { products: data, source };
}
