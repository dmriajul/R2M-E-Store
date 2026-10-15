/**
 * User-account data layer for the **Staff & Roles** console.
 *
 * Same two rules as the other `lib/data/*` admin modules:
 *
 * 1. **No mock fallback.** Reads return `null` when Postgres is not configured
 *    (the page then lists the demo accounts instead) and writes throw — a super
 *    admin is never told a role changed, or an account was trashed, when nothing
 *    was persisted.
 * 2. **Rows in, plain objects out.** Prisma types stop at this module, and the
 *    stored role always leaves through `normalizeRole()`, so the legacy `ADMIN`
 *    value reads as `SUPER_ADMIN` everywhere downstream.
 *
 * Deletion is a **soft delete**: `User.deletedAt` parks an account in the console
 * trash (it can no longer sign in) and the purge cron deletes it for good once
 * `TRASH_RETENTION_DAYS` has passed. Anything that holds a foreign key to the
 * account — an order, a review — blocks the permanent delete, because an order
 * must keep its customer.
 *
 * The *policy* (who may change what) lives in `app/admin/actions.ts` and
 * `lib/rbac.ts`; this module only reads and writes rows.
 */

import { AdminDataError } from "@/lib/data/admin-errors";
import { getPrisma, type PrismaLikeClient } from "@/lib/prisma";
import { TRASH_RETENTION_DAYS, normalizeRole, trashRetentionCutoff } from "@/lib/rbac";
import type { AdminUserAccount, SessionRole } from "@/types";

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  createdAt: Date | string;
  deletedAt?: Date | string | null;
  deletedById?: string | null;
}

/** Dates out of Prisma, as ISO strings (or `null` when the column is empty). */
function toIso(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toAdminUserAccount(
  row: UserRow,
  deletedByNames?: ReadonlyMap<string, string>,
): AdminUserAccount {
  const deletedById = row.deletedById ?? null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? "",
    role: normalizeRole(row.role),
    joinedAt: toIso(row.createdAt) ?? String(row.createdAt ?? ""),
    deletedAt: toIso(row.deletedAt),
    deletedById,
    /* Only resolvable while the admin who trashed the account still exists. */
    deletedBy: deletedById ? (deletedByNames?.get(deletedById) ?? null) : null,
  };
}

/** Prisma's "record not found" code, without importing the generated enums. */
function isMissingRow(error: unknown): boolean {
  return hasPrismaCode(error, "P2025");
}

/** Unique-constraint violation — two accounts claiming the same email. */
function isDuplicateEmail(error: unknown): boolean {
  return hasPrismaCode(error, "P2002");
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
  deletedAt: true,
  deletedById: true,
} as const;

/** The rows behind `ids`, in whatever state they are (live *and* trashed). */
async function rowsByIds(
  db: PrismaLikeClient,
  ids: readonly string[],
  where: Record<string, unknown> = {},
): Promise<UserRow[]> {
  const rows = (await db.user.findMany({
    where: { id: { in: [...ids] }, ...where },
    select: USER_SELECT,
  })) as UserRow[];

  return rows;
}

/**
 * `deletedById` → name, so the trash can say who moved an account there. One
 * extra query for the whole page, and a missing admin simply resolves to `null`
 * (the console then shows the date without a name).
 */
async function deletedByNames(
  db: PrismaLikeClient,
  rows: readonly UserRow[],
): Promise<ReadonlyMap<string, string>> {
  const ids = Array.from(
    new Set(rows.map((row) => row.deletedById).filter((id): id is string => Boolean(id))),
  );
  if (ids.length === 0) return new Map();

  const admins = (await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  })) as Array<{ id: string; name: string }>;

  return new Map(admins.map((admin) => [admin.id, admin.name]));
}

/** Rows → accounts, with "Deleted by" resolved in one pass. */
async function toAccounts(
  db: PrismaLikeClient,
  rows: readonly UserRow[],
): Promise<AdminUserAccount[]> {
  const names = await deletedByNames(db, rows);
  return rows.map((row) => toAdminUserAccount(row, names));
}

/**
 * Every account, newest first — **trashed ones included**, because
 * `/admin/staff` feeds both the accounts list and the trash from this one read
 * (`getAdminUserAccounts({ includeTrashed: false })` narrows it).
 *
 * Returns `null` when no database is configured (or the read failed), which the
 * console distinguishes from "there are no accounts yet" — it then falls back to
 * the five demo logins.
 */
export async function getAdminUserAccounts(
  options: { includeTrashed?: boolean } = {},
): Promise<AdminUserAccount[] | null> {
  const db = await getPrisma();
  if (!db) return null;

  const includeTrashed = options.includeTrashed ?? true;

  try {
    const rows = (await db.user.findMany({
      where: includeTrashed ? {} : { deletedAt: null },
      orderBy: [{ createdAt: "desc" }],
      select: USER_SELECT,
    })) as UserRow[];

    return await toAccounts(db, rows);
  } catch (error) {
    console.error("[admin/users] Could not load accounts", error);
    return null;
  }
}

/**
 * Moves one account to a new role and returns its fresh row.
 *
 * Throws `AdminDataError` when the row has gone (someone else's console tab may
 * be showing a stale list). Trashed accounts are refused — `app/admin/actions.ts`
 * checks the same rule first, this is the second line of defence.
 */
export async function updateAdminUserRole(
  id: string,
  role: SessionRole,
): Promise<AdminUserAccount> {
  const db = await getPrisma();
  if (!db) {
    throw new AdminDataError("Changing a role requires a configured database");
  }

  try {
    const row = (await db.user.update({
      where: { id },
      data: { role },
      select: USER_SELECT,
    })) as UserRow;

    if (row.deletedAt) {
      throw new AdminDataError("That account is in the trash — restore it before changing its role");
    }

    return toAdminUserAccount(row);
  } catch (error) {
    if (isMissingRow(error)) {
      throw new AdminDataError("That account no longer exists — reload the console");
    }
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/*  Trash                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Soft-deletes accounts: stamps `deletedAt` (and the operator behind it) and
 * returns their fresh rows for the console's trash list.
 *
 * `deletedAt: null` in the filter is deliberate — an account that is already
 * trashed is left exactly as it was, so a double-click can't rewrite the date
 * and silently reset the retention countdown.
 */
export async function trashAdminUsers(
  ids: readonly string[],
  deletedById: string,
  now: Date = new Date(),
): Promise<AdminUserAccount[]> {
  const db = await getPrisma();
  if (!db) {
    throw new AdminDataError("Trashing an account requires a configured database");
  }

  await db.user.updateMany({
    where: { id: { in: [...ids] }, deletedAt: null },
    data: { deletedAt: now, deletedById },
  });

  const rows = await rowsByIds(db, ids, { deletedAt: { not: null } });
  if (rows.length === 0) {
    throw new AdminDataError("Those accounts are no longer in the console — reload the console");
  }

  return toAccounts(db, rows);
}

/**
 * Puts accounts back on the accounts list.
 *
 * `email` is `@unique`, so an account that was trashed and whose address was
 * later registered again can't simply be restored — that surfaces as a plain
 * "change the email first" message rather than a Prisma error.
 */
export async function restoreAdminUsers(ids: readonly string[]): Promise<AdminUserAccount[]> {
  const db = await getPrisma();
  if (!db) {
    throw new AdminDataError("Restoring an account requires a configured database");
  }

  try {
    await db.user.updateMany({
      where: { id: { in: [...ids] }, deletedAt: { not: null } },
      data: { deletedAt: null, deletedById: null },
    });
  } catch (error) {
    if (isDuplicateEmail(error)) {
      throw new AdminDataError(
        "Another account now uses that email — change it before restoring",
      );
    }
    throw error;
  }

  const rows = await rowsByIds(db, ids, { deletedAt: null });
  if (rows.length === 0) {
    throw new AdminDataError("Those accounts are not in the trash — reload the console");
  }

  return toAccounts(db, rows);
}

/**
 * The relations that keep an account alive: an order (or a review) points at its
 * author with a foreign key, so deleting the account would either break or erase
 * real store history. Both are counted per purge so the console can explain
 * itself instead of throwing a constraint error.
 */
async function heldRecords(
  db: PrismaLikeClient,
  ids: readonly string[],
): Promise<{ orders: number; reviews: number }> {
  const [orders, reviews] = await Promise.all([
    db.order.count({ where: { userId: { in: [...ids] } } }),
    db.review.count({ where: { userId: { in: [...ids] } } }),
  ]);

  return { orders, reviews };
}

/** One-line explanation for accounts that can't be deleted yet. */
function heldRecordsMessage(ids: readonly string[], held: { orders: number; reviews: number }): string {
  const parts: string[] = [];
  if (held.orders > 0) parts.push(`${held.orders} order${held.orders === 1 ? "" : "s"}`);
  if (held.reviews > 0) parts.push(`${held.reviews} review${held.reviews === 1 ? "" : "s"}`);

  return `${ids.length} account${ids.length === 1 ? "" : "s"} still hold${ids.length === 1 ? "s" : ""} ${parts.join(" and ")} — an order keeps its customer, so these can't be deleted permanently. Restore them instead.`;
}

/**
 * Deletes trashed accounts for good. Only rows that are **already in the trash**
 * are touched, so a stale console tab can never hard-delete a live account.
 *
 * Returns how many rows went; throws `AdminDataError` when any of them still
 * holds an order or a review.
 */
export async function purgeAdminUsers(ids: readonly string[]): Promise<number> {
  const db = await getPrisma();
  if (!db) {
    throw new AdminDataError("Deleting an account requires a configured database");
  }

  const rows = await rowsByIds(db, ids, { deletedAt: { not: null } });
  if (rows.length === 0) {
    throw new AdminDataError("Those accounts are not in the trash — reload the console");
  }

  const trashedIds = rows.map((row) => row.id);
  const held = await heldRecords(db, trashedIds);
  if (held.orders > 0 || held.reviews > 0) {
    throw new AdminDataError(heldRecordsMessage(trashedIds, held));
  }

  const { count } = await db.user.deleteMany({
    where: { id: { in: trashedIds }, deletedAt: { not: null } },
  });

  return count;
}

/**
 * The retention sweeper behind the purge cron (`/api/cron/purge-trash`): every
 * trashed account whose window has closed **and** that holds no orders or
 * reviews is deleted; the rest are reported as `skipped` and left for a human.
 *
 * Exported as a plain function — not a Server Action — so the cron route can
 * call it on a schedule with no session of its own.
 */
export async function purgeExpiredAdminUsers(
  options: { retentionDays?: number; now?: Date } = {},
): Promise<{ purged: number; skipped: number }> {
  const db = await getPrisma();
  if (!db) return { purged: 0, skipped: 0 };

  const cutoff = trashRetentionCutoff(
    options.now ?? new Date(),
    options.retentionDays ?? TRASH_RETENTION_DAYS,
  );

  const expired = (await db.user.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true },
  })) as Array<{ id: string }>;

  const ids = expired.map((row) => row.id);
  if (ids.length === 0) return { purged: 0, skipped: 0 };

  const held = await heldRecords(db, ids);
  const blocked = new Set<string>();

  if (held.orders > 0 || held.reviews > 0) {
    /* One query to find out which of the expired rows are the held ones. */
    const [withOrders, withReviews] = await Promise.all([
      db.order.findMany({
        where: { userId: { in: ids } },
        select: { userId: true },
      }) as Promise<Array<{ userId: string }>>,
      db.review.findMany({
        where: { userId: { in: ids } },
        select: { userId: true },
      }) as Promise<Array<{ userId: string }>>,
    ]);

    for (const row of [...withOrders, ...withReviews]) blocked.add(row.userId);
  }

  const purgeable = ids.filter((id) => !blocked.has(id));
  if (purgeable.length === 0) return { purged: 0, skipped: ids.length };

  const { count } = await db.user.deleteMany({
    where: { id: { in: purgeable }, deletedAt: { lt: cutoff } },
  });

  return { purged: count, skipped: ids.length - count };
}

/**
 * Alias of `purgeExpiredAdminUsers()` under the name the purge cron imports.
 * Kept as one line so the two entry points can never drift apart.
 */
export const purgeExpiredTrash = purgeExpiredAdminUsers;
