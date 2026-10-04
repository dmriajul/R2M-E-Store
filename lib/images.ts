/**
 * Image helpers.
 *
 * The catalogue ships with **placeholder tokens** (`"floral-summer-dress-1"`)
 * because there is no photography in the repo. When a real URL arrives — from
 * Cloudinary or the local `/uploads/…` route — the artwork component switches to
 * `next/image`; anything else keeps rendering the gradient tile.
 */

/**
 * Cloudinary URL helpers.
 *
 * They live here — not in `lib/cloudinary.ts` — because they are pure string
 * maths: client components (product artwork, the admin uploader) can use them
 * without pulling the Node-only Cloudinary SDK into the browser bundle.
 */
export const isCloudinaryUrl = (url: string): boolean =>
  typeof url === "string" && url.includes("res.cloudinary.com");

/** Rewrites a Cloudinary delivery URL with `f_auto,q_auto` and a width cap. */
export function optimizeUrl(url: string, width = 900): string {
  if (!url || !isCloudinaryUrl(url) || !url.includes("/upload/")) return url;
  const transform = `f_auto,q_auto,c_limit,w_${width}`;
  return url.replace("/upload/", `/upload/${transform}/`);
}

/** Extracts the public id from a Cloudinary delivery URL (for deletes). */
export function publicIdFromUrl(url: string): string | null {
  if (!isCloudinaryUrl(url) || !url.includes("/upload/")) return null;

  const afterUpload = url.split("/upload/")[1];
  if (!afterUpload) return null;

  const withoutTransform = afterUpload.replace(/^[^/]*?(?:v\d+)/, "");
  const path = withoutTransform.startsWith("/")
    ? withoutTransform.slice(1)
    : afterUpload.replace(/^v\d+\//, "");

  return path.replace(/\.[a-z0-9]+$/i, "") || null;
}

/**
 * True for anything the browser can load as an image.
 *
 * Placeholder tokens (`"floral-summer-dress-1"`) are the only thing that fails
 * this test, which is exactly how `ProductArtwork` decides between a real photo
 * and the gradient tile.
 */
export function isRenderableImage(src: string | undefined): boolean {
  if (!src) return false;
  return (
    src.startsWith("/") ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:image/")
  );
}

/** Optimised source for `next/image` (Cloudinary gets f_auto/q_auto). */
export function imageSrc(src: string, width = 900): string {
  return isCloudinaryUrl(src) ? optimizeUrl(src, width) : src;
}

/** First renderable image in a product's `images` array, if any. */
export function firstRenderableImage(images: readonly string[] | undefined): string | undefined {
  return images?.find((entry) => isRenderableImage(entry));
}

/* -------------------------------------------------------------------------- */
/*  Cloudinary folders (also used by the admin uploader, so keep them here)     */
/* -------------------------------------------------------------------------- */

export const PRODUCT_FOLDER = "little-luxe/products";
export const MODEL_FOLDER = "little-luxe/models";

/** Recommended `sizes` attribute per artwork context. */
export const IMAGE_SIZES = {
  card: "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw",
  detail: "(min-width: 1024px) 45vw, 100vw",
  thumb: "88px",
  hero: "100vw",
} as const;

export type ImageSizeContext = keyof typeof IMAGE_SIZES;

/* -------------------------------------------------------------------------- */
/*  Upload validation (shared by the API route and the admin form)             */
/* -------------------------------------------------------------------------- */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_MODEL_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_MODEL_TYPES = ["model/gltf-binary", "application/octet-stream"] as const;

export interface FileValidation {
  ok: boolean;
  error?: string;
  kind: "image" | "model";
}

/** Client- and server-side guard for the upload endpoint. */
export function validateUploadFile(
  file: { name: string; type: string; size: number },
  kind: "image" | "model" = "image",
): FileValidation {
  const isModel = kind === "model" || file.name.toLowerCase().endsWith(".glb");

  if (isModel) {
    if (!file.name.toLowerCase().endsWith(".glb")) {
      return { ok: false, error: "Only .glb files are supported", kind: "model" };
    }
    if (file.size > MAX_MODEL_BYTES) {
      return { ok: false, error: "3D models must be 10MB or smaller", kind: "model" };
    }
    return { ok: true, kind: "model" };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { ok: false, error: "Use a JPEG, PNG or WebP image", kind: "image" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Images must be 5MB or smaller", kind: "image" };
  }
  return { ok: true, kind: "image" };
}

/** "2.4 MB" — used in upload progress copy. */
export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
