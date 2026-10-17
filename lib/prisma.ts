/**
 * Prisma singleton.
 *
 * - **Account flows always require a database** (`requireDatabase` /
 *   `withRequiredDatabase`): authentication, registration and order writes fail
 *   closed in every environment.
 * - **Storefront catalogue reads degrade gracefully** (`withDatabase`): when no
 *   `DATABASE_URL` is configured at all — a fresh Vercel deploy in demo mode —
 *   they resolve to the documented mock fallback instead of white-screening the
 *   route. Real query failures on a configured database still propagate in
 *   production so stale mock data can never shadow live data.
 */

import { isDatabaseConfigured } from "@/lib/demo-mode";

/** The slice of the Prisma client surface the data layer actually uses. */
export interface PrismaDelegate {
  findMany(args?: unknown): Promise<unknown[]>;
  findUnique(args: unknown): Promise<unknown | null>;
  findFirst(args?: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  upsert(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  deleteMany(args: unknown): Promise<{ count: number }>;
  count(args?: unknown): Promise<number>;
}

export interface PrismaLikeClient {
  user: PrismaDelegate;
  verificationToken: PrismaDelegate;
  /** Role-change audit trail (`RoleChange`) — see lib/data/admin-users.ts. */
  roleChange: PrismaDelegate;
  product: PrismaDelegate;
  order: PrismaDelegate;
  orderItem: PrismaDelegate;
  returnRequest: PrismaDelegate;
  productVariant: PrismaDelegate;
  coupon: PrismaDelegate;
  category: PrismaDelegate;
  review: PrismaDelegate;
  wishlistItem: PrismaDelegate;
  address: PrismaDelegate;
  siteSettings: PrismaDelegate;
  $disconnect?(): Promise<void>;
  $transaction<T>(operation: (transaction: PrismaLikeClient) => Promise<T>): Promise<T>;
}

type PrismaGlobal = typeof globalThis & {
  prisma?: PrismaLikeClient;
  prismaUnavailable?: boolean;
};

const globalForPrisma = globalThis as PrismaGlobal;

let client: PrismaLikeClient | null = null;

/**
 * Resolves the Prisma client, or `null` when no database is configured (in any
 * environment) — callers that treat "unconfigured" as a fallback state (`if
 * (!db) return null`) work exactly as their docs promise. Client
 * initialization failures still throw `DatabaseUnavailableError` in
 * production so a broken install can't silently masquerade as "unconfigured".
 * Dynamic loading keeps the client out of browser bundles and allows static
 * builds without a live connection.
 */
export async function getPrisma(): Promise<PrismaLikeClient | null> {
  if (!isDatabaseConfigured()) return null;
  if (globalForPrisma.prismaUnavailable) {
    if (process.env.NODE_ENV === "production") throw new DatabaseUnavailableError();
    return null;
  }
  if (client) return client;
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  try {
    const mod = (await import("@prisma/client")) as unknown as {
      PrismaClient?: new (options?: unknown) => PrismaLikeClient;
    };
    if (!mod.PrismaClient) throw new Error("@prisma/client exported no PrismaClient");

    client = new mod.PrismaClient({ log: [] });
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
    return client;
  } catch {
    // Do not latch initialization failures forever; a subsequent request may recover.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[prisma] client unavailable:",
        "Check database configuration and generated client.",
      );
    }
    if (process.env.NODE_ENV === "production") throw new DatabaseUnavailableError();
    return null;
  }
}

/**
 * Catalogue/read helper. Falls back to the mock dataset when **no database is
 * configured at all** (demo deploys, `npm run dev` without `.env`) — the
 * storefront contract is "every call resolves, so the storefront never sees an
 * error state it can't render" (see `lib/data/products.ts`). On a configured
 * database, query failures propagate in production and fall back only in
 * development: mock data must never shadow a live database that is merely
 * having a bad day.
 */
export async function withDatabase<T>(
  query: (db: PrismaLikeClient) => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<{ data: T; source: "database" | "mock" }> {
  if (!isDatabaseConfigured()) {
    return { data: await fallback(), source: "mock" };
  }
  const db = await getPrisma();
  if (!db) {
    if (process.env.NODE_ENV === "production") throw new DatabaseUnavailableError();
    return { data: await fallback(), source: "mock" };
  }
  try {
    return { data: await query(db), source: "database" };
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    console.warn("[prisma] Development query failed; using development-only catalogue fallback.");
    return { data: await fallback(), source: "mock" };
  }
}

/**
 * True when a database is configured *and* the client resolved. Callers that
 * only need a yes/no answer (health checks, admin badges) use this instead of
 * importing Prisma themselves.
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  try { return (await getPrisma()) !== null; } catch { return false; }
}

/** Authentication and transactional writes must never pretend a DB failure succeeded. */
export class DatabaseUnavailableError extends Error {
  constructor() {
    super("Account service is temporarily unavailable. Please try again later.");
    this.name = "DatabaseUnavailableError";
  }
}

export async function withRequiredDatabase<T>(
  query: (db: PrismaLikeClient) => Promise<T>,
  demo: () => T | Promise<T>,
): Promise<{ data: T; source: "database" | "mock" }> {
  if (!isDatabaseConfigured()) {
    // Production must not silently enable well-known demo administrator accounts.
    if (process.env.NODE_ENV === "production") {
      throw new DatabaseUnavailableError();
    }
    return { data: await demo(), source: "mock" };
  }
  const db = await getPrisma();
  if (!db) throw new DatabaseUnavailableError();
  return { data: await query(db), source: "database" };
}

/** Durable operations have NO development/demo fallback, including when ALLOW_DEMO_MODE is set. */
export async function requireDatabase<T>(query: (db: PrismaLikeClient) => Promise<T>): Promise<T> {
  const db = await getPrisma();
  if (!db) throw new DatabaseUnavailableError();
  return query(db);
}
