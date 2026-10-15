import path from "node:path";

/**
 * Local upload storage.
 *
 * Files live in `.uploads/` at the project root (git-ignored) and are served
 * through the `app/uploads/[...path]` route, because `next start` only serves
 * `public/` files that existed at build time. Cloudinary replaces all of this
 * as soon as the three Cloudinary env keys are set.
 */

export const UPLOAD_ROOT = path.join(process.cwd(), ".uploads");

/** Public URL prefix the stored files are reachable at. */
export const UPLOAD_URL_PREFIX = "/uploads";

/**
 * Local storage buckets for uploaded assets.
 *
 * `products` / `categories` / `banners` mirror the console's Cloudinary
 * folders (`lib/media.ts`); `payments` / `returns` hold customer evidence from
 * `/api/upload`, kept apart so the console's delete endpoint can never reach it.
 */
export const UPLOAD_BUCKETS = {
  products: "products",
  categories: "categories",
  banners: "banners",
  hero: "hero",
  payments: "payments",
  returns: "returns",
  uploads: "uploads",
} as const;

export type UploadBucket = (typeof UPLOAD_BUCKETS)[keyof typeof UPLOAD_BUCKETS];

/** Content types we ever store locally. Anything else is refused. */
export const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
};
