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

/** Buckets: one for product images, one for `.glb` models. */
export const UPLOAD_BUCKETS = { products: "products", models: "models" } as const;

/** Content types we ever store locally. Anything else is refused. */
export const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  glb: "model/gltf-binary",
};
