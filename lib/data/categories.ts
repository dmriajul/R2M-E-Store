/**
 * Category data layer (admin console).
 *
 * `Category` rows hold console metadata only — `Product.category` keeps the
 * fixed category names the storefront filters on (see `lib/validations.ts`), so
 * renaming a category here never orphans the catalogue.
 *
 * Two rules apply to every access in this file:
 *
 * 1. **No fallback list.** Reads and writes throw when Postgres is not
 *    reachable — a signed-in operator must never be shown a hardcoded category
 *    list, nor told a change was saved when nothing was persisted.
 * 2. **Rows in, plain objects out.** Prisma types never leak past this module.
 */

import { AdminDataError } from "@/lib/data/admin-errors";
import { scheduleImageCleanup } from "@/lib/data/media";
import { isRenderableImage } from "@/lib/images";
import { DatabaseUnavailableError, getPrisma, type PrismaLikeClient } from "@/lib/prisma";
import { adminCategorySchema, type AdminCategoryValues } from "@/lib/validations";
import type { AdminCategory } from "@/types";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  description: string;
  parent: string | null;
  image: string | null;
}

function toAdminCategory(row: CategoryRow): AdminCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    emoji: row.emoji,
    description: row.description,
    parent: row.parent && row.parent.length > 0 ? row.parent : null,
    image: row.image && row.image.length > 0 ? row.image : null,
  };
}

/**
 * The cover image a category has right now (for cleanup after a change).
 * Never throws — a failed read only means no cleanup.
 */
async function readCategoryImage(db: PrismaLikeClient, id: string): Promise<string | null> {
  try {
    const row = (await db.category.findUnique({
      where: { id },
      select: { image: true },
    })) as { image: string | null } | null;
    return row?.image ?? null;
  } catch (error) {
    console.error("[admin/categories] Could not read the current cover image", error);
    return null;
  }
}

/** Prisma's unique-constraint violation, without importing the generated enums. */
function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function isMissingRow(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  );
}

/**
 * Every category, ordered the way the console lists them.
 * Throws when no database is configured; the console layout catches and
 * renders the empty tables with a "not connected" notice.
 */
export async function getAdminCategories(): Promise<AdminCategory[]> {
  const db = await requirePrisma();

  const rows = (await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      emoji: true,
      description: true,
      parent: true,
      image: true,
    },
  })) as CategoryRow[];

  return rows.map(toAdminCategory);
}

/** Fails closed: the console never falls back to a hardcoded category list. */
async function requirePrisma() {
  const db = await getPrisma();
  if (!db) throw new DatabaseUnavailableError();
  return db;
}

/**
 * Creates or updates a category.
 *
 * @param values already-validated form values (the action validates with
 *               `adminCategorySchema` first, then parses again here).
 * @param id     omit to create; pass the row id to update.
 */
export async function saveAdminCategory(
  values: AdminCategoryValues,
  id?: string,
): Promise<AdminCategory> {
  const parsed = adminCategorySchema.parse(values);
  const db = await requirePrisma();

  // `undefined` (field omitted) leaves the stored cover untouched.
  const image = parsed.image === undefined ? undefined : parsed.image || null;
  const data = {
    name: parsed.name,
    slug: parsed.slug,
    emoji: parsed.emoji,
    description: parsed.description?.trim() ? parsed.description : "New category",
    parent: parsed.parent ? parsed.parent : null,
    image,
  };

  try {
    const previousImage = id && image !== undefined ? await readCategoryImage(db, id) : null;
    const row = (id
      ? await db.category.update({ where: { id }, data })
      : await db.category.create({
          data: { ...data, sortOrder: await db.category.count() },
        })) as CategoryRow;

    // A replaced or removed cover is deleted once nothing else uses it.
    scheduleImageCleanup([previousImage], [row.image]);
    return toAdminCategory(row);
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new AdminDataError("Another category already uses this name or slug");
    }
    if (isMissingRow(error)) {
      throw new AdminDataError("That category no longer exists — reload the console");
    }
    throw error;
  }
}

/** Deletes a category. Throws when the row has already gone. */
export async function deleteAdminCategory(id: string): Promise<void> {
  const db = await requirePrisma();

  try {
    const image = await readCategoryImage(db, id);
    await db.category.delete({ where: { id } });
    scheduleImageCleanup([image]);
  } catch (error) {
    if (isMissingRow(error)) {
      throw new AdminDataError("That category no longer exists — reload the console");
    }
    throw error;
  }
}

/**
 * Storefront: uploaded cover images keyed by category slug (only categories
 * that have one). Returns `{}` without a database or on any error, so the
 * "Shop by Category" tiles simply keep their bundled photography.
 */
export async function getCategoryImageMap(): Promise<Record<string, string>> {
  const db = await getPrisma();
  if (!db) return {};

  try {
    const rows = (await db.category.findMany({
      where: { image: { not: null } },
      select: { slug: true, image: true },
    })) as Array<{ slug: string; image: string | null }>;

    const images: Record<string, string> = {};
    for (const row of rows) {
      if (isRenderableImage(row.image)) images[row.slug] = row.image;
    }
    return images;
  } catch (error) {
    console.error("[categories] Could not load category cover images", error);
    return {};
  }
}
