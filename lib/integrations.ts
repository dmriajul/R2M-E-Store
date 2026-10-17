/**
 * Optional third-party integrations.
 *
 * Feature probes only — nothing here holds data. Each helper answers "are the
 * credentials for this service present?", and callers degrade to the built-in
 * behaviour (local disk uploads, cash on delivery) when they are not.
 */

/** True when a Postgres connection string is present. */
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
