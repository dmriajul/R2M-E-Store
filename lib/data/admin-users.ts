/**
 * User-account data layer for the **Staff & Roles** console.
 *
 * Same two rules as the other `lib/data/*` admin modules:
 *
 * 1. **No mock fallback.** The read returns `null` when Postgres is not
 *    configured (the page then lists the demo accounts instead) and writes
 *    throw — a super admin is never told a role changed when nothing was
 *    persisted.
 * 2. **Rows in, plain objects out.** Prisma types stop at this module, and the
 *    stored role always leaves through `normalizeRole()`, so the legacy `ADMIN`
 *    value reads as `SUPER_ADMIN` everywhere downstream.
 *
 * The *policy* (who may change what) lives in `app/admin/actions.ts`, next to
 * the permission check; this module only reads and writes rows.
 */

import { AdminDataError } from "@/lib/data/admin-errors";
import { getPrisma } from "@/lib/prisma";
import { normalizeRole } from "@/lib/rbac";
import type { AdminUserAccount, SessionRole } from "@/types";

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  createdAt: Date;
}

function toAdminUserAccount(row: UserRow): AdminUserAccount {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? "",
    role: normalizeRole(row.role),
    joinedAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

/** Prisma's "record not found" code, without importing the generated enums. */
function isMissingRow(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  );
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
} as const;

/**
 * Every account, newest first.
 *
 * Returns `null` when no database is configured (or the read failed), which the
 * console distinguishes from "there are no accounts yet" — it then falls back to
 * the five demo logins.
 */
export async function getAdminUserAccounts(): Promise<AdminUserAccount[] | null> {
  const db = await getPrisma();
  if (!db) return null;

  try {
    const rows = (await db.user.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: USER_SELECT,
    })) as UserRow[];

    return rows.map(toAdminUserAccount);
  } catch (error) {
    console.error("[admin/users] Could not load accounts", error);
    return null;
  }
}

/**
 * Moves one account to a new role and returns its fresh row.
 *
 * Throws `AdminDataError` when the row has gone (someone else's console tab may
 * be showing a stale list).
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

    return toAdminUserAccount(row);
  } catch (error) {
    if (isMissingRow(error)) {
      throw new AdminDataError("That account no longer exists — reload the console");
    }
    throw error;
  }
}
