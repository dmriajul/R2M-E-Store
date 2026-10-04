/**
 * Prisma client singleton.
 *
 * Two things matter here:
 *
 * 1. **Next.js dev reloads** must not spawn a new pool on every HMR tick, hence
 *    the `globalThis` cache.
 * 2. **The client is optional.** When `DATABASE_URL` is missing — or the client
 *    has not been generated yet (`npx prisma generate`) — `getPrisma()` resolves
 *    to `null` and every caller falls back to the mock dataset instead of
 *    crashing the request.
 */

import { isDatabaseConfigured } from "@/lib/demo-mode";

/** The slice of the Prisma client surface the data layer actually uses. */
export interface PrismaDelegate {
  findMany(args?: unknown): Promise<unknown[]>;
  findUnique(args: unknown): Promise<unknown | null>;
  findFirst(args?: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  deleteMany(args: unknown): Promise<{ count: number }>;
  count(args?: unknown): Promise<number>;
}

export interface PrismaLikeClient {
  user: PrismaDelegate;
  product: PrismaDelegate;
  order: PrismaDelegate;
  orderItem: PrismaDelegate;
  coupon: PrismaDelegate;
  review: PrismaDelegate;
  wishlistItem: PrismaDelegate;
  address: PrismaDelegate;
}

type PrismaGlobal = typeof globalThis & {
  prisma?: PrismaLikeClient;
  prismaUnavailable?: boolean;
};

const globalForPrisma = globalThis as PrismaGlobal;

let client: PrismaLikeClient | null = null;

/**
 * Resolves the Prisma client, or `null` when the database is not configured.
 * The import is dynamic so a missing/ungenerated client can never break the
 * build — it only ever throws inside this try/catch.
 */
export async function getPrisma(): Promise<PrismaLikeClient | null> {
  if (!isDatabaseConfigured()) return null;
  if (globalForPrisma.prismaUnavailable) return null;
  if (client) return client;
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  try {
    const mod = (await import("@prisma/client")) as unknown as {
      PrismaClient?: new (options?: unknown) => PrismaLikeClient;
    };
    if (!mod.PrismaClient) throw new Error("@prisma/client exported no PrismaClient");

    client = new mod.PrismaClient({ log: ["error"] });
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
    return client;
  } catch (error) {
    // Not generated, unreachable host, bad credentials… all degrade to demo mode.
    globalForPrisma.prismaUnavailable = true;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[prisma] client unavailable — falling back to mock data:",
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  }
}

/** Typed helper: run `query`, fall back to `fallback` on any failure. */
export async function withDatabase<T>(
  query: (db: PrismaLikeClient) => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<{ data: T; source: "database" | "mock" }> {
  const db = await getPrisma();

  if (db) {
    try {
      return { data: await query(db), source: "database" };
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[prisma] query failed — serving mock data:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  return { data: await fallback(), source: "mock" };
}

/**
 * True when a database is configured *and* the client resolved. Callers that
 * only need a yes/no answer (health checks, admin badges) use this instead of
 * importing Prisma themselves.
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  return (await getPrisma()) !== null;
}
