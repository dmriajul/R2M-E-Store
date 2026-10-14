/**
 * Category data layer (admin console).
 *
 * `Category` rows hold console metadata only — `Product.category` keeps the
 * fixed category names the storefront filters on (see `lib/validations.ts`), so
 * renaming a category here never orphans the catalogue.
 *
 * Two rules apply to every write in this file:
 *
 * 1. **No mock fallback.** Reads return `null` when Postgres is not reachable
 *    (the console then keeps its in-session demo list), and writes throw. They
 *    are never quietly redirected into `lib/mock-admin.ts` — a signed-in
 *    operator must not be told a change was saved when nothing was persisted.
 * 2. **Rows in, plain objects out.** Prisma types never leak past this module.
 */

import { AdminDataError } from "@/lib/data/admin-errors";
import { getPrisma } from "@/lib/prisma";
import { adminCategorySchema, type AdminCategoryValues } from "@/lib/validations";
import type { AdminCategory } from "@/types";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  description: string;
  parent: string | null;
}

function toAdminCategory(row: CategoryRow): AdminCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    emoji: row.emoji,
    description: row.description,
    parent: row.parent && row.parent.length > 0 ? row.parent : null,
  };
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
 * Returns `null` when no database is configured, so the caller can tell
 * "console has no server data" apart from "the table is empty".
 */
export async function getAdminCategories(): Promise<AdminCategory[] | null> {
  const db = await getPrisma();
  if (!db) return null;

  try {
    const rows = (await db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        emoji: true,
        description: true,
        parent: true,
      },
    })) as CategoryRow[];

    return rows.map(toAdminCategory);
  } catch (error) {
    // A read must never take the console down: log it and let the caller fall
    // back to the in-session list. Writes deliberately do not do this.
    console.error("[admin/categories] Could not load categories", error);
    return null;
  }
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
  const db = await getPrisma();
  if (!db) {
    throw new AdminDataError("Saving a category requires a configured database");
  }

  const data = {
    name: parsed.name,
    slug: parsed.slug,
    emoji: parsed.emoji,
    description: parsed.description?.trim() ? parsed.description : "New category",
    parent: parsed.parent ? parsed.parent : null,
  };

  try {
    const row = (id
      ? await db.category.update({ where: { id }, data })
      : await db.category.create({
          data: { ...data, sortOrder: await db.category.count() },
        })) as CategoryRow;

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
  const db = await getPrisma();
  if (!db) {
    throw new AdminDataError("Deleting a category requires a configured database");
  }

  try {
    await db.category.delete({ where: { id } });
  } catch (error) {
    if (isMissingRow(error)) {
      throw new AdminDataError("That category no longer exists — reload the console");
    }
    throw error;
  }
}
