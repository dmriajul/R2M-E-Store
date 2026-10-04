/**
 * Demo-mode switch.
 *
 * The whole backend is optional: every integration (Postgres via Prisma,
 * NextAuth credentials, Cloudinary uploads, live payments) degrades to the
 * in-memory mock data the storefront already ships with. That's how the app
 * runs in this sandbox with **no environment variables at all**, and how it
 * flips to the real backend the moment credentials are added.
 */

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
export const dataSourceLabel = (): string => (IS_DEMO ? "demo" : "database");

export const DEMO_PASSWORD = "password123";
export const DEMO_ADMIN_EMAIL = "admin@littleluxe.com";
export const DEMO_ADMIN_PASSWORD = "admin123";
