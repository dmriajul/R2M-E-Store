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

/* -------------------------------------------------------------------------- */
/*  Row normalization                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Postgres hands back `null` for these columns, even though Prisma says it can't.
 *
 * `prisma/schema.prisma` declares `categories`/`colors`/`sizes`/`images` as
 * non-null `String[]`, but the deployed DDL (`supabase/tests/schema.sql`)
 * created them as plain nullable `TEXT[]` with no `NOT NULL`. Any row written
 * outside Prisma — a SQL import, a backfill, a restore — can therefore hold
 * NULL, while the *generated* client types still promise `string[]`. The
 * compiler cannot warn about it, so the first dereference
 * (`row.images.some(…)`) throws inside the Server Component render and takes
 * the whole storefront down to the error boundary.
 *
 * Every row → domain mapper normalizes through these helpers so the `Product`
 * invariants the UI relies on actually hold. `lib/data/returns.ts` and
 * `lib/data/orders.ts` already did this inline; these are the shared versions.
 */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

/** Text column that the DDL may allow NULL on. */
export function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Numeric column that the DDL may allow NULL on. */
export function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * The row shape we read back from Postgres.
 *
 * Fields the deployed DDL allows NULL on are typed nullable on purpose — a
 * generated Prisma type claiming `string[]` is what hid this in the first
 * place. Normalize with the helpers above before building a `Product`.
 */
export interface ProductRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | null;
  originalPrice: number | null;
  category: string | null;
  categories?: string[] | null;
  gender: string | null;
  ageRange: string | null;
  material: string | null;
  colors: string[] | null;
  sizes: string[] | null;
  images: string[] | null;
  stock: number | null;
  variants?: ProductInventoryVariant[] | null;
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

export function toProductCategory(value: string | null | undefined): ProductCategory {
  return CATEGORIES.includes(value as ProductCategory) ? (value as ProductCategory) : "Accessories";
}

function toGender(value: string | null | undefined): ProductGender {
  return value === "Boys" || value === "Unisex" ? value : "Girls";
}

/** Database row → storefront `Product`. */
export function rowToProduct(row: ProductRow): Product {
  const category = toProductCategory(row.category);
  const variantRows = Array.isArray(row.variants) ? row.variants : [];
  const variants = variantRows.length
    ? variantRows.map(({ size, color, stock }) => ({ size, color, stock }))
    : undefined;
  const stock = variants
    ? variants.reduce((total, variant) => total + toNumber(variant.stock), 0)
    : toNumber(row.stock);
  /* `images` is nullable in the deployed DDL — normalizing here is what keeps
     `/`, `/shop`, `/product/[id]` and `/sitemap.xml` rendering when a row has
     no gallery. */
  const gallery = toStringArray(row.images);
  const images = gallery.some(isRenderableImage)
    ? gallery
    : [...(PRODUCT_IMAGES[row.slug] ?? gallery)];
  const description = toText(row.description);
  const extraCategories = toStringArray(row.categories).map(toProductCategory);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: description.slice(0, 96),
    description,
    price: toNumber(row.price),
    originalPrice: row.originalPrice ?? undefined,
    compareAtPrice: row.originalPrice ?? undefined,
    currency: "BDT",
    images,
    category,
    categories: extraCategories.length ? extraCategories : [category],
    ageRange: toText(row.ageRange, "0-12Y"),
    gender: toGender(row.gender),
    colors: toStringArray(row.colors),
    sizes: toStringArray(row.sizes),
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
