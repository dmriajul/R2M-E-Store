/** Prisma singleton. Production reads/writes fail closed; account flows always require a database. */

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
 * Resolves the Prisma client. Production configuration/client failures throw;
 * development callers may receive null. Dynamic loading keeps the client out
 * of browser bundles and allows static builds without a live connection.
 */
export async function getPrisma(): Promise<PrismaLikeClient | null> {
  if (!isDatabaseConfigured() || globalForPrisma.prismaUnavailable) {
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

/** Catalogue/read helper: development fallback only; production failures propagate. */
export async function withDatabase<T>(
  query: (db: PrismaLikeClient) => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<{ data: T; source: "database" | "mock" }> {
  if (process.env.NODE_ENV === "production") {
    return { data: await requireDatabase(query), source: "database" };
  }
  const db = await getPrisma();
  if (db) {
    try { return { data: await query(db), source: "database" }; }
    catch { console.warn("[prisma] Development query failed; using development-only catalogue fallback."); }
  }
  return { data: await fallback(), source: "mock" };
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
