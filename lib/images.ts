/**
 * Image helpers.
 *
 * Demo catalogue products use Unsplash photography. Admin-managed photos can
 * come from Cloudinary or the local `/uploads/…` route; legacy non-URL tokens
 * remain supported by the branded artwork fallback.
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
 * Legacy placeholder tokens (`"floral-summer-dress-1"`) fail this test, which
 * lets `ProductArtwork` choose its branded fallback.
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

export const PRODUCT_FOLDER = "mukra/products";

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
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export interface FileValidation {
  ok: boolean;
  error?: string;
  kind: "image" | "video";
}

/** Client- and server-side guard for the upload endpoint. */
export function validateUploadFile(file: {
  name: string;
  type: string;
  size: number;
}): FileValidation {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { ok: false, error: "Use a JPEG, PNG or WebP image", kind: "image" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Images must be 5MB or smaller", kind: "image" };
  }
  return { ok: true, kind: "image" };
}

export const MAX_HERO_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_HERO_VIDEO_BYTES = 100 * 1024 * 1024;

const HERO_MEDIA_TYPES: Readonly<Record<string, { type: string; kind: "image" | "video" }>> = {
  jpg: { type: "image/jpeg", kind: "image" },
  jpeg: { type: "image/jpeg", kind: "image" },
  png: { type: "image/png", kind: "image" },
  webp: { type: "image/webp", kind: "image" },
  gif: { type: "image/gif", kind: "image" },
  mp4: { type: "video/mp4", kind: "video" },
  webm: { type: "video/webm", kind: "video" },
};

export function validateHeroUploadFile(file: {
  name: string;
  type: string;
  size: number;
}): FileValidation & { kind: "image" | "video" } {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowed = HERO_MEDIA_TYPES[extension];
  if (!allowed || file.type !== allowed.type) {
    return {
      ok: false,
      error: "Use a JPG, PNG, WebP or GIF image, or an MP4 or WebM video",
      kind: allowed?.kind ?? "image",
    };
  }

  const maxBytes = allowed.kind === "video" ? MAX_HERO_VIDEO_BYTES : MAX_HERO_IMAGE_BYTES;
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: allowed.kind === "video" ? "Videos must be 100MB or smaller" : "Images must be 10MB or smaller",
      kind: allowed.kind,
    };
  }

  return { ok: true, kind: allowed.kind };
}

/** "2.4 MB" — used in upload progress copy. */
export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
