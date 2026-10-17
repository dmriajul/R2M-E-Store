/** Development catalogue/UI fixtures only. Account flows always require Prisma;
 * production data helpers fail closed even if ALLOW_DEMO_MODE is set. */

/** True when no Postgres connection string is configured. */
export const IS_DEMO = !process.env.DATABASE_URL;

/** Prisma is only touched when a database URL exists. */
export const isDatabaseConfigured = (): boolean => Boolean(process.env.DATABASE_URL);

/** Cloudinary uploads need all three keys; otherwise we write to /public/uploads. */
export const isCloudinaryConfigured = (): boolean =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );

/** SSLCommerz stays a placeholder until a real merchant account exists. */
export const isSSLCommerzEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_ENABLE_SSLCOMMERZ === "true" &&
  Boolean(process.env.SSLCOMMERZ_STORE_ID);

/** Human label used in the UI and in API payloads. */
export const dataSourceLabel = (): string => (IS_DEMO ? (process.env.NODE_ENV === "production" ? "unconfigured" : "demo") : "database");

/** The password for every demo account — staff roles included. */
export const DEMO_PASSWORD = "password123";

/** Super-admin demo account (the other staff logins are in `lib/data/users.ts`). */
export const DEMO_ADMIN_EMAIL = "admin@mukra.com";
