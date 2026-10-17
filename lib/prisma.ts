/**
 * Prisma singleton.
 *
 * **Every read and every write requires a database.** There is no demo mode
 * and no mock catalogue: when `DATABASE_URL` is missing, or the client cannot
 * be built, or a query fails, the call throws `DatabaseUnavailableError` and
 * the route surfaces its error state (500/503) instead of quietly rendering
 * sample rows.
 */

import { isDatabaseConfigured } from "@/lib/integrations";

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
 * Resolves the Prisma client, or `null` when the database is not usable.
 *
 * `null` is only ever an *unconfigured* state (`DATABASE_URL` absent, or the
 * generated client could not be loaded) — a real connection error propagates
 * from the query itself. Callers that must serve data turn `null` into
 * `DatabaseUnavailableError` via {@link requireDatabase}; callers that can
 * legitimately render "nothing here" (the admin console's empty tables) check
 * it themselves.
 *
 * Dynamic loading keeps the client out of browser bundles and allows static
 * builds without a live connection.
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

    client = new mod.PrismaClient({ log: [] });
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
    return client;
  } catch (error) {
    // Do not latch initialization failures forever; a subsequent request may recover.
    console.warn(
      "[prisma] client unavailable — check DATABASE_URL and run `npx prisma generate`.",
    );
    throw new DatabaseUnavailableError(error);
  }
}

/** Re-exported so callers can import it next to the client it guards. */
export { isDatabaseConfigured } from "@/lib/integrations";

/**
 * True when a database is configured *and* the client resolved. Callers that
 * only need a yes/no answer (health checks, readiness probes) use this instead
 * of importing Prisma themselves.
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    return (await getPrisma()) !== null;
  } catch {
    return false;
  }
}

/**
 * The single failure mode for "the catalogue is not readable right now".
 *
 * Surfaced to operators and visitors as a maintenance error; the storefront
 * error boundary renders a dedicated message for it (see
 * `app/(shop)/error.tsx`).
 */
export class DatabaseUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      "The store's database is unavailable. Set DATABASE_URL, run `npx prisma generate` and `npx prisma db push`, then retry.",
    );
    this.name = "DatabaseUnavailableError";
    if (cause !== undefined) this.cause = cause;
  }
}

/** Runs a query against a live client, or fails closed. */
export async function requireDatabase<T>(query: (db: PrismaLikeClient) => Promise<T>): Promise<T> {
  const db = await getPrisma();
  if (!db) throw new DatabaseUnavailableError();
  return query(db);
}
