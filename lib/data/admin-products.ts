import { AdminDataError } from "@/lib/data/admin-errors";
import { scheduleImageCleanup } from "@/lib/data/media";
import { DatabaseUnavailableError, getPrisma } from "@/lib/prisma";
import {
  adminProductSchema,
  type AdminProductSeoValues,
  type AdminProductValues,
} from "@/lib/validations";
import {
  toProductCategory,
  type ProductRow,
} from "@/lib/data/products";
import type { AdminProduct, ProductBadge, ProductGender } from "@/types";

interface AdminVariantRow {
  size: string;
  color: string;
  stock: number;
  sku: string | null;
}

interface AdminProductRow extends Omit<ProductRow, "variants"> {
  sku: string | null;
  costPrice: number;
  categories: string[];
  variants: AdminVariantRow[];
  lowStockThreshold: number;
  trackInventory: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  featuredOrder: number;
  virtualBoutique: boolean;
  newArrival: boolean;
  bestSeller: boolean;
}

function toAdminProduct(row: AdminProductRow): AdminProduct {
  const category = toProductCategory(row.category);
  const colors = row.colors.length ? row.colors : ["Pink"];
  const stock = row.variants.length
    ? row.variants.reduce((total, variant) => total + variant.stock, 0)
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
    images: row.images.length ? row.images : [`${row.slug}-1`],
    category,
    categories: row.categories.length
      ? row.categories.map(toProductCategory)
      : [category],
    ageRange: row.ageRange,
    gender: (row.gender === "Boys" || row.gender === "Unisex"
      ? row.gender
      : "Girls") as ProductGender,
    colors,
    sizes: row.sizes,
    material: row.material ?? "Organic cotton",
    badge: (row.badge as ProductBadge | null) ?? undefined,
    tags: [],
    rating: 5,
    reviewCount: 0,
    stock,
    variants: row.variants.map((variant) => ({
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
      ...(variant.sku ? { sku: variant.sku } : {}),
    })),
    inStock: stock > 0 && row.active,
    featured: row.featured,
    featuredOrder: row.featuredOrder,
    virtualBoutique: row.virtualBoutique,
    newArrival: row.newArrival,
    bestSeller: row.bestSeller,
    status: row.active ? "active" : "draft",
    createdAt:
      typeof row.createdAt === "string"
        ? row.createdAt
        : (row.createdAt?.toISOString() ?? new Date().toISOString()),
    sku: row.sku ?? `LL-${row.slug.toUpperCase().replace(/[^A-Z0-9-]/g, "-")}`,
    costPrice: row.costPrice,
    lowStockThreshold: row.lowStockThreshold,
    trackInventory: row.trackInventory,
    metaTitle: row.metaTitle ?? `${row.name} | Mukra`,
    metaDescription: row.metaDescription ?? row.description.slice(0, 160),
  };
}

const productInclude = {
  variants: { select: { size: true, color: true, stock: true, sku: true } },
};

/**
 * Every product row, newest first. Throws `DatabaseUnavailableError` when the
 * database is not reachable — the console layout catches it and renders empty
 * tables with a "not connected" notice.
 */
export async function getAdminProducts(): Promise<AdminProduct[]> {
  const db = await requireDatabase();
  const rows = (await db.product.findMany({
    include: productInclude,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  })) as AdminProductRow[];

  return rows.map(toAdminProduct);
}

/**
 * Storefront/API entry point. Throws when no database is configured, so
 * `POST /api/admin/products` answers 503 instead of pretending the product
 * was saved.
 */
export async function saveAdminProduct(
  values: AdminProductValues,
  id?: string,
): Promise<AdminProduct> {
  const db = await requireDatabase();
  return writeAdminProduct(db, values, id);
}

/**
 * Console entry point for the Server Action: identical write, but a missing
 * database is an error instead of a silent no-op, so the operator sees why the
 * product was not saved.
 */
export async function persistAdminProduct(
  values: AdminProductValues,
  id?: string,
): Promise<AdminProduct> {
  const db = await requireDatabase();
  return writeAdminProduct(db, values, id);
}

async function writeAdminProduct(
  db: AdminDatabase,
  values: AdminProductValues,
  id?: string,
): Promise<AdminProduct> {
  const colors = values.colors.map((color) => color.name);
  const data = {
    name: values.name,
    slug: values.slug,
    sku: values.sku,
    description: values.description,
    price: values.price,
    costPrice: values.costPrice ?? 0,
    originalPrice: values.compareAtPrice ?? null,
    category: values.category,
    categories: Array.from(new Set(values.categories)),
    gender: values.gender,
    ageRange: `${values.ageMin}-${values.ageMax}Y`,
    material: "Organic cotton",
    colors,
    sizes: values.sizes,
    images: values.images.length ? values.images : [`${values.slug}-1`],
    stock: values.variants.reduce((total, variant) => total + variant.stock, 0),
    lowStockThreshold: values.lowStockThreshold,
    trackInventory: values.trackInventory,
    badge: values.badge === "none" ? null : values.badge,
    featured: values.featured,
    featuredOrder: values.featuredOrder,
    virtualBoutique: values.virtualBoutique,
    newArrival: values.newArrival,
    bestSeller: values.bestSeller,
    active: values.active,
    metaTitle: values.metaTitle?.trim() || `${values.name} | Mukra`,
    metaDescription:
      values.metaDescription?.trim() || values.description.slice(0, 160),
    variants: id
      ? {
          deleteMany: {},
          create: values.variants.map((variant) => ({
            size: variant.size,
            color: variant.color,
            stock: variant.stock,
            sku: variant.sku?.trim() || null,
          })),
        }
      : {
          create: values.variants.map((variant) => ({
            size: variant.size,
            color: variant.color,
            stock: variant.stock,
            sku: variant.sku?.trim() || null,
          })),
        },
  };

  const { material, ...updateData } = data;
  const previousImages = id ? await readProductImages(db, id) : [];
  const row = (id
    ? await db.product.update({
        where: { id },
        data: updateData,
        include: productInclude,
      })
    : await db.product.create({
        data: { ...updateData, material },
        include: productInclude,
      })) as AdminProductRow;

  // Photos dropped from the gallery are deleted once nothing else uses them.
  scheduleImageCleanup(previousImages, row.images);
  return toAdminProduct(row);
}

/**
 * The gallery a product has right now, read before an update so removed
 * photos can be cleaned up. Never throws — a failed read only skips cleanup.
 */
async function readProductImages(db: AdminDatabase, id: string): Promise<string[]> {
  try {
    const row = (await db.product.findUnique({
      where: { id },
      select: { images: true },
    })) as { images: string[] } | null;
    return row?.images ?? [];
  } catch (error) {
    console.error("[admin/products] Could not read the current gallery", error);
    return [];
  }
}

export function parseAdminProduct(input: unknown) {
  return adminProductSchema.safeParse(input);
}

/* -------------------------------------------------------------------------- */
/*  Console mutations                                                         */
/* -------------------------------------------------------------------------- */
/*  Prisma only — no mock fallback. A console write either commits or throws;  */
/*  the Server Action in `app/admin/actions.ts` turns the throw into an error  */
/*  the operator can see. An unconfigured database surfaces as a 503.          */

/** Prisma's unique-constraint violation. */
function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** Prisma's foreign-key violation — a product that appears in an order. */
function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2003"
  );
}

async function requireDatabase() {
  const db = await getPrisma();
  if (!db) {
    // Unconfigured is a 503, not an operator mistake.
    throw new DatabaseUnavailableError();
  }
  return db;
}


/**
 * Applies the SEO manager's slice of a product (slug, metadata, badge,
 * publication and display placement). Everything else — name, description,
 * pricing, media, stock — is left untouched, so this action can never
 * accidentally overwrite an inventory edit.
 */
export async function updateAdminProductSeo(
  id: string,
  values: AdminProductSeoValues,
): Promise<AdminProduct> {
  const db = await requireDatabase();

  const data: Record<string, unknown> = {};
  if (values.slug !== undefined) data.slug = values.slug;
  if (values.metaTitle !== undefined) {
    data.metaTitle = values.metaTitle.trim() || null;
  }
  if (values.metaDescription !== undefined) {
    data.metaDescription = values.metaDescription.trim() || null;
  }
  if (values.badge !== undefined) data.badge = values.badge === "none" ? null : values.badge;
  if (values.categories !== undefined) {
    data.categories = Array.from(new Set(values.categories));
  }
  if (values.active !== undefined) data.active = values.active;
  if (values.featured !== undefined) data.featured = values.featured;
  if (values.featuredOrder !== undefined) data.featuredOrder = values.featuredOrder;
  if (values.virtualBoutique !== undefined) data.virtualBoutique = values.virtualBoutique;
  if (values.newArrival !== undefined) data.newArrival = values.newArrival;
  if (values.bestSeller !== undefined) data.bestSeller = values.bestSeller;

  if (Object.keys(data).length === 0) return loadAdminProduct(db, id);

  try {
    const row = (await db.product.update({
      where: { id },
      data,
      include: productInclude,
    })) as AdminProductRow;

    return toAdminProduct(row);
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new AdminDataError("Another product already uses this slug");
    }
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code === "P2025") {
      throw new AdminDataError("That product no longer exists — reload the console");
    }
    throw error;
  }
}

/** Re-reads one product as the console renders it. */
export async function getAdminProduct(id: string): Promise<AdminProduct> {
  const db = await requireDatabase();
  return loadAdminProduct(db, id);
}

type AdminDatabase = NonNullable<Awaited<ReturnType<typeof getPrisma>>>;

async function loadAdminProduct(
  db: AdminDatabase,
  id: string,
): Promise<AdminProduct> {
  const row = (await db.product.findUnique({
    where: { id },
    include: productInclude,
  })) as AdminProductRow | null;

  if (!row) {
    throw new AdminDataError("That product no longer exists — reload the console");
  }
  return toAdminProduct(row);
}

/**
 * Deletes products (and their variants, via `onDelete: Cascade`).
 *
 * Products referenced by an order can't be hard-deleted — the order lines are
 * the sales history. Those report a friendly message instead; the operator can
 * switch `Active` off to hide the product from the storefront.
 */
export async function deleteAdminProducts(ids: string[]): Promise<number> {
  const db = await requireDatabase();

  try {
    const galleries = (await db.product.findMany({
      where: { id: { in: ids } },
      select: { images: true },
    })) as Array<{ images: string[] }>;
    const result = await db.product.deleteMany({ where: { id: { in: ids } } });
    // Photos only these products used are deleted from the media library.
    scheduleImageCleanup(galleries.flatMap((gallery) => gallery.images));
    return result.count;
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new AdminDataError(
        "A product in this selection appears in existing orders, so it can't be deleted. Turn off Active to hide it from the storefront instead.",
      );
    }
    throw error;
  }
}

/** Copies a product as an unpublished draft, exactly like the console action. */
export async function duplicateAdminProduct(id: string): Promise<AdminProduct> {
  const db = await requireDatabase();
  const source = (await db.product.findUnique({
    where: { id },
    include: productInclude,
  })) as AdminProductRow | null;

  if (!source) {
    throw new AdminDataError("That product no longer exists — reload the console");
  }

  const row = (await db.product.create({
    data: {
      name: `${source.name} (Copy)`,
      slug: await uniqueCopySlug(db, source.slug),
      sku: await uniqueCopySku(db, source.sku),
      description: source.description,
      price: source.price,
      costPrice: source.costPrice,
      originalPrice: source.originalPrice,
      category: source.category,
      categories: source.categories.length ? source.categories : [source.category],
      gender: source.gender,
      ageRange: source.ageRange,
      material: source.material,
      colors: source.colors,
      sizes: source.sizes,
      images: source.images,
      stock: source.stock,
      lowStockThreshold: source.lowStockThreshold,
      trackInventory: source.trackInventory,
      badge: source.badge,
      /* Copies start as drafts — they are never published by accident. */
      featured: false,
      featuredOrder: 0,
      virtualBoutique: false,
      newArrival: false,
      bestSeller: false,
      active: false,
      metaTitle: source.metaTitle,
      metaDescription: source.metaDescription,
      variants: {
        create: source.variants.map((variant) => ({
          size: variant.size,
          color: variant.color,
          stock: variant.stock,
          sku: variant.sku,
        })),
      },
    },
    include: productInclude,
  })) as AdminProductRow;

  return toAdminProduct(row);
}

async function uniqueCopySlug(db: AdminDatabase, base: string): Promise<string> {
  let candidate = `${base}-copy`;
  let suffix = 2;

  while (await db.product.findFirst({ where: { slug: candidate } })) {
    candidate = `${base}-copy-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function uniqueCopySku(
  db: AdminDatabase,
  sku: string | null,
): Promise<string | null> {
  if (!sku) return null;

  let candidate = `${sku}-C1`;
  let suffix = 2;

  while (await db.product.findFirst({ where: { sku: candidate } })) {
    candidate = `${sku}-C${suffix}`;
    suffix += 1;
  }

  return candidate;
}

/** Bulk "sold out": clears the product and every variant. */
export async function setAdminProductsOutOfStock(ids: string[]): Promise<number> {
  const db = await requireDatabase();

  await db.productVariant.updateMany({
    where: { productId: { in: ids } },
    data: { stock: 0 },
  });

  const result = await db.product.updateMany({
    where: { id: { in: ids } },
    data: { stock: 0 },
  });

  return result.count;
}

/**
 * Adds `units` to a product, spread as evenly as possible across its variants
 * (the same maths the console's store uses), and returns the fresh record.
 */
export async function restockAdminProduct(
  id: string,
  units: number,
): Promise<AdminProduct> {
  const db = await requireDatabase();
  const row = (await db.product.findUnique({
    where: { id },
    include: productInclude,
  })) as AdminProductRow | null;

  if (!row) {
    throw new AdminDataError("That product no longer exists — reload the console");
  }

  const variantCount = row.variants.length;
  const variantStock = row.variants.reduce((total, variant) => total + variant.stock, 0);
  const stock = (variantCount > 0 ? variantStock : row.stock) + units;

  if (variantCount > 0) {
    const perVariant = Math.floor(units / variantCount);
    const remainder = units % variantCount;

    await Promise.all(
      row.variants.map((variant, index) =>
        db.productVariant.updateMany({
          where: { productId: id, size: variant.size, color: variant.color },
          data: { stock: variant.stock + perVariant + (index < remainder ? 1 : 0) },
        }),
      ),
    );
  }

  await db.product.update({ where: { id }, data: { stock } });
  return loadAdminProduct(db, id);
}
