/**
 * Products data layer.
 *
 * Every read goes to Postgres through Prisma. There is no catalogue baked into
 * the app: when the database is unreachable the call throws
 * `DatabaseUnavailableError` and the route renders its error state, and when
 * the `Product` table is simply empty the caller gets `[]` and shows its empty
 * state.
 */

import { CATEGORY_META } from "@/lib/site";
import { isDatabaseConfigured, requireDatabase } from "@/lib/prisma";
import type {
  Product,
  ProductBadge,
  ProductCategory,
  ProductGender,
  ProductInventoryVariant,
  Review,
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

const productVariantSelect = {
  variants: { select: { size: true, color: true, stock: true } },
} as const;

/** Database row → storefront `Product`. */
export function rowToProduct(row: ProductRow): Product {
  const category = toProductCategory(row.category);
  const variants = row.variants?.length
    ? row.variants.map(({ size, color, stock }) => ({ size, color, stock }))
    : undefined;
  const stock = variants
    ? variants.reduce((total, variant) => total + variant.stock, 0)
    : row.stock;

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
    images: [...row.images],
    category,
    categories:
      row.categories?.length
        ? row.categories.map(toProductCategory)
        : [category],
    ageRange: row.ageRange,
    gender: toGender(row.gender),
    colors: row.colors,
    sizes: row.sizes,
    material: row.material ?? "",
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
  /** Products to leave out (used by the "you may also like" rail). */
  excludeId?: string;
}

/**
 * Catalogue read outcome, surfaced to pages.
 *
 * `listProducts` deliberately throws `DatabaseUnavailableError` when the
 * database cannot be read — tests and API routes depend on that contract.
 * Pages, however, must tell three different situations apart so they can render
 * the right surface:
 *
 *   • `empty`        — the database answered, there are simply no rows yet;
 *   • `unconfigured` — no `DATABASE_URL` at all (fresh deploy / preview), which
 *                      is a setup state, not an outage;
 *   • `unavailable`  — a database *is* configured but the read failed, which is
 *                      the only case that deserves the maintenance notice.
 */
export type CatalogueStatus = "ready" | "empty" | "unconfigured" | "unavailable";

export interface CatalogueSnapshot {
  products: Product[];
  status: CatalogueStatus;
}

/** True only for a real, configured-but-failing database. */
export function isCatalogueOutage(status: CatalogueStatus): boolean {
  return status === "unavailable";
}

// One diagnostic per state per process minute — parallel sections on the home
// page all read the catalogue and must not flood the server log.
const warnedAt = new Map<CatalogueStatus, number>();

function warnOnce(status: CatalogueStatus): void {
  const now = Date.now();
  if (now - (warnedAt.get(status) ?? -Infinity) < 60_000) return;
  warnedAt.set(status, now);

  if (status === "unconfigured") {
    console.warn(
      "[catalogue] DATABASE_URL is not configured — showing the curated-soon empty state. " +
        "Add the Supabase connection string on the host to load real products.",
    );
  } else {
    console.error(
      "[catalogue] The database is configured but unreachable — showing the maintenance state. " +
        "Check the connection string, network access and database status.",
    );
  }
}

/**
 * Page-friendly catalogue read.
 *
 * Never throws for the two failure states above: an unconfigured or unreachable
 * database resolves to an empty snapshot plus the matching status so the page
 * can keep its layout and show the right message. Non-database errors still
 * propagate — those are bugs, not a setup/outage condition.
 */
export async function getCatalogue(
  query: ProductQuery = {},
): Promise<CatalogueSnapshot> {
  try {
    const { products } = await listProducts(query);
    return { products, status: products.length > 0 ? "ready" : "empty" };
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "DatabaseUnavailableError") {
      throw error;
    }

    const status: CatalogueStatus = isDatabaseConfigured() ? "unavailable" : "unconfigured";
    warnOnce(status);
    return { products: [], status };
  }
}

/** Catalogue listing. An empty table means an empty list — never sample rows. */
export async function listProducts(
  query: ProductQuery = {},
): Promise<{ products: Product[]; source: "database" }> {
  const products = await requireDatabase(async (db) => {
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
        ...(query.excludeId ? { id: { not: query.excludeId } } : {}),
      },
      include: productVariantSelect,
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
  });

  return { products, source: "database" };
}

/** Single product by slug **or** id. */
export async function findProduct(identifier: string): Promise<{
  product: Product | null;
  source: "database";
}> {
  const product = await requireDatabase(async (db) => {
    const row = (await db.product.findFirst({
      where: {
        OR: [{ slug: identifier }, { id: identifier }],
        active: true,
      },
      include: productVariantSelect,
    })) as ProductRow | null;
    return row ? rowToProduct(row) : null;
  });

  return { product, source: "database" };
}

/** Stock lookup used by the order API to re-price lines. */
export async function findProductsByIds(ids: readonly string[]): Promise<{
  products: Product[];
  source: "database";
}> {
  const unique = Array.from(new Set(ids));

  const products = await requireDatabase(async (db) => {
    const rows = (await db.product.findMany({
      where: { id: { in: unique }, active: true },
      include: productVariantSelect,
    })) as ProductRow[];
    return rows.map(rowToProduct);
  });

  return { products, source: "database" };
}

/**
 * "You may also like": same category first, then the same gender, then
 * anything else — all straight from the catalogue table.
 */
export async function listRelatedProducts(
  product: Product,
  limit = 4,
): Promise<Product[]> {
  const [sameCategory, everything] = await Promise.all([
    listProducts({ category: product.category, excludeId: product.id, limit: 100 }),
    listProducts({ excludeId: product.id, limit: 100 }),
  ]);

  const picked: Product[] = [];
  const seen = new Set<string>([product.id]);

  const take = (candidates: readonly Product[]) => {
    for (const candidate of candidates) {
      if (picked.length >= limit) return;
      if (seen.has(candidate.id)) continue;
      picked.push(candidate);
      seen.add(candidate.id);
    }
  };

  take(sameCategory.products);
  take(everything.products.filter((candidate) => candidate.gender === product.gender));
  take(everything.products);

  return picked.slice(0, limit);
}

/** One review row as the product page renders it. */
interface ReviewRow {
  id: string;
  rating: number;
  comment: string;
  createdAt: Date | string;
  user?: { name: string | null; email: string } | null;
}

function authorOf(row: ReviewRow): string {
  const name = row.user?.name?.trim();
  if (name) return name;
  const email = row.user?.email ?? "";
  return email ? email.split("@")[0]! : "Verified buyer";
}

/**
 * Real reviews for one product, newest first.
 *
 * The `Review` table is the only source; an empty table means the product page
 * shows its "no reviews yet" state.
 */
export async function listProductReviews(productId: string): Promise<Review[]> {
  return requireDatabase(async (db) => {
    const rows = (await db.review.findMany({
      where: { productId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    })) as ReviewRow[];

    return rows.map((row) => {
      const created =
        typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString();

      return {
        id: row.id,
        author: authorOf(row),
        location: "",
        rating: row.rating,
        title: "",
        body: row.comment,
        date: new Date(created).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        verified: true,
      };
    });
  });
}
