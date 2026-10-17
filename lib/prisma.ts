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

// Log operational causes, never raw Prisma messages: they can contain a URL,
// username or query parameters. Limit repeated diagnostics from parallel page
// sections so an outage does not flood the development console.
const lastDiagnostic = new Map<string, number>();
function diagnose(reason: string): void {
  const now = Date.now();
  if (now - (lastDiagnostic.get(reason) ?? -Infinity) < 30_000) return;
  lastDiagnostic.set(reason, now);
  console.error(`[prisma] ${reason}`);
}

const connectionFailures: Record<string, string> = {
  P1000: "authentication failed — check the database username/password in DATABASE_URL",
  P1001: "host unreachable — check the hostname, port, network and database status",
  P1002: "connection timed out — check network access and the database host",
  P1003: "database does not exist — check the database name in DATABASE_URL",
  P1008: "operation timed out — check database load and network latency",
  P1009: "database already exists — check the target database",
  P1010: "access denied — check the database user's permissions",
  P1011: "TLS connection failed — check the database SSL configuration",
  P1012: "invalid database configuration — check DATABASE_URL and the Prisma schema",
  P1017: "connection closed — check database availability and connection limits",
  P2021: "table missing — apply the schema to the configured database",
  P2022: "column missing — apply the schema to the configured database",
  P2024: "connection pool exhausted or timed out — check pool size and active clients",
};

/** Safe operational diagnosis without leaking connection strings or query data. */
export function databaseFailureReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const { code, name } = error as { code?: unknown; name?: unknown };
  if (typeof code === "string" && Object.hasOwn(connectionFailures, code)) {
    return `${code}: ${connectionFailures[code]}`;
  }
  if (name === "PrismaClientInitializationError") {
    return "client initialization/connection failed — check DATABASE_URL, database access and generated Prisma Client";
  }
  return null;
}

function validDatabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["postgresql:", "postgres:"].includes(url.protocol) &&
      Boolean(url.hostname && url.pathname.slice(1));
  } catch {
    return false;
  }
}

/**
 * Resolves the Prisma client, or `null` when the database is not usable.
 *
 * `null` is only an *unconfigured* state (`DATABASE_URL` absent). Client
 * initialization and connection failures throw `DatabaseUnavailableError`.
 * Callers that must serve data turn `null` into that error via
 * {@link requireDatabase}; callers that can
 * legitimately render "nothing here" (the admin console's empty tables) check
 * it themselves.
 *
 * Dynamic loading keeps the client out of browser bundles and allows static
 * builds without a live connection.
 */
export async function getPrisma(): Promise<PrismaLikeClient | null> {
  if (!isDatabaseConfigured()) {
    diagnose("DATABASE_URL is missing or empty. Set it in .env.local and restart next dev.");
    return null;
  }
  if (!validDatabaseUrl(process.env.DATABASE_URL!)) {
    diagnose("DATABASE_URL must be a PostgreSQL URI with a hostname and database name (see .env.example).");
    throw new DatabaseUnavailableError();
  }
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
    diagnose(databaseFailureReason(error) ??
      "Prisma Client could not be initialized — run `npx prisma generate` and check DATABASE_URL.");
    throw new DatabaseUnavailableError(error);
  }
}

/** Re-exported so callers can import it next to the client it guards. */
export { isDatabaseConfigured } from "@/lib/integrations";

/**
 * True only when a database is configured and a small query succeeds.
 * A constructed Prisma Client alone does not prove connectivity.
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    return await requireDatabase(async (db) => {
      await db.user.findFirst({ select: { id: true } });
      return true;
    });
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
  try {
    return await query(db);
  } catch (error) {
    const reason = databaseFailureReason(error);
    if (!reason) throw error; // Do not turn unrelated application errors into maintenance.
    diagnose(reason);
    throw new DatabaseUnavailableError(error);
  }
}
