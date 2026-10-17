/**
 * Products data layer.
 *
 * Queries Postgres through Prisma when `DATABASE_URL` is set, and falls back to
 * the mock catalogue in `lib/site.ts` otherwise — every call resolves, so the
 * storefront never sees an error state it can't render.
 */

import { CATEGORY_META, PRODUCT_IMAGES, PRODUCTS, getProductById } from "@/lib/site";
import { isRenderableImage } from "@/lib/images";
import { withDatabase, withRequiredDatabase } from "@/lib/prisma";
import type {
  Product,
  ProductBadge,
  ProductCategory,
  ProductGender,
  ProductInventoryVariant,
} from "@/types";

/** The row shape we read back from Postgres. */
export interface ProductRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  originalPrice: number | null;
  category: string;
  categories?: string[];
  gender: string;
  ageRange: string;
  material: string | null;
  colors: string[];
  sizes: string[];
  images: string[];
  stock: number;
  variants?: ProductInventoryVariant[];
  badge: string | null;
  featured: boolean;
  featuredOrder?: number;
  virtualBoutique?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
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
  const variants = row.variants?.length
    ? row.variants.map(({ size, color, stock }) => ({ size, color, stock }))
    : undefined;
  const stock = variants
    ? variants.reduce((total, variant) => total + variant.stock, 0)
    : row.stock;
  const images = row.images.some(isRenderableImage)
    ? row.images
    : [...(PRODUCT_IMAGES[row.slug] ?? row.images)];

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.description.slice(0, 96),
    description: row.description,
    price: row.price,
    originalPrice: row.originalPrice ?? undefined,
    compareAtPrice: row.originalPrice ?? undefined,
    currency: "BDT",
    images,
    category,
    categories:
      row.categories?.length
        ? row.categories.map(toProductCategory)
        : [category],
    ageRange: row.ageRange,
    gender: toGender(row.gender),
    colors: row.colors,
    sizes: row.sizes,
    material: row.material ?? "Organic cotton",
    badge: (row.badge as ProductBadge | null) ?? undefined,
    tags: [],
    rating: 5,
    reviewCount: 0,
    stock,
    ...(variants ? { variants } : {}),
    inStock: stock > 0 && row.active,
    featured: row.featured,
    featuredOrder: row.featuredOrder ?? 0,
    virtualBoutique: row.virtualBoutique ?? false,
    newArrival: row.newArrival ?? false,
    bestSeller: row.bestSeller ?? false,
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
  placement?: "virtualBoutique" | "newArrival" | "bestSeller";
  /**
   * Standalone sort. Only `"newest"` is supported — it is what the home page's
   * New Arrivals grid needs (the 8 most recently added pieces, regardless of
   * whether anyone remembered to tick the `newArrival` flag).
   *
   * Precedence when several options are combined: `featured` > `placement` >
   * `sort` > default (oldest first).
   */
  sort?: "newest";
  activeOnly?: boolean;
  limit?: number;
}

/** Catalogue listing. Fallback: the 12 seeded mock products. */
export async function listProducts(
  query: ProductQuery = {},
): Promise<{ products: Product[]; source: "database" | "mock" }> {
  const { data, source } = await withDatabase<Product[]>(
    async (db) => {
      const rows = (await db.product.findMany({
        where: {
          ...(query.category
            ? {
                OR: [
                  { category: query.category },
                  { categories: { has: query.category } },
                ],
              }
            : {}),
          ...(query.featured ? { featured: true } : {}),
          ...(query.placement ? { [query.placement]: true } : {}),
          ...(query.activeOnly === false ? {} : { active: true }),
        },
        include: {
          variants: { select: { size: true, color: true, stock: true } },
        },
        orderBy: query.featured
          ? [{ featuredOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }]
          : query.placement
            ? [{ createdAt: "desc" }, { id: "asc" }]
            : query.sort === "newest"
              ? [{ createdAt: "desc" }, { id: "asc" }]
              : [{ createdAt: "asc" }, { id: "asc" }],
        ...(query.limit
          ? { take: Math.min(Math.max(Math.trunc(query.limit), 1), 100) }
          : {}),
      })) as ProductRow[];

      return rows.map(rowToProduct);
    },
    () =>
      PRODUCTS.filter(
        (product) =>
          (!query.category ||
            product.category === query.category ||
            product.categories?.includes(toProductCategory(query.category))) &&
          (!query.featured || product.featured) &&
          (!query.placement || product[query.placement]) &&
          (query.activeOnly === false || product.status === "active"),
      )
        .sort((a, b) =>
          query.featured
            ? (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0) ||
              b.createdAt.localeCompare(a.createdAt) ||
              a.id.localeCompare(b.id)
            : query.placement
              ? b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
              : query.sort === "newest"
                ? b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
                : a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        )
        .slice(0, query.limit ? Math.min(Math.max(Math.trunc(query.limit), 1), 100) : undefined),
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
        where: {
          OR: [{ slug: identifier }, { id: identifier }],
          active: true,
        },
        include: {
          variants: { select: { size: true, color: true, stock: true } },
        },
      })) as ProductRow | null;
      return row ? rowToProduct(row) : null;
    },
    () => {
      const product = getProductById(identifier);
      return product?.status === "active" ? product : null;
    },
  );

  return { product: data, source };
}

/** Stock lookup used by the order API to re-price lines. */
export async function findProductsByIds(ids: readonly string[]): Promise<{
  products: Product[];
  source: "database" | "mock";
}> {
  const unique = Array.from(new Set(ids));

  const { data, source } = await withRequiredDatabase<Product[]>(
    async (db) => {
      const rows = (await db.product.findMany({
        where: { id: { in: unique }, active: true },
        include: {
          variants: { select: { size: true, color: true, stock: true } },
        },
      })) as ProductRow[];
      return rows.map(rowToProduct);
    },
    () =>
      unique
        .map((id) => getProductById(id))
        .filter((product): product is Product => Boolean(product)),
  );

  return { products: data, source };
}
