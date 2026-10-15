/**
 * Image helpers.
 *
 * Demo catalogue products use stock photography. Admin-managed photos come
 * from Cloudinary (or, in demo installs, the local `/uploads/…` route); legacy
 * non-URL tokens remain supported by the branded artwork fallback.
 *
 * Everything here is pure string maths — no Node APIs, no secrets — so client
 * components (product artwork, `OptimizedImage`, the admin uploader) can use it
 * without pulling the Node-only Cloudinary SDK into the browser bundle.
 */

import type { ImageLoader } from "next/image";

/* -------------------------------------------------------------------------- */
/*  Cloudinary delivery URLs                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Widest rendition ever requested from Cloudinary. Uploads are stored at most
 * 1920px wide (`c_limit` never upscales), so asking for more only burns
 * transformation credits on identical files.
 */
export const CLOUDINARY_MAX_WIDTH = 1920;

/** `res.cloudinary.com` plus the legacy sharded `res-1…res-5` hosts. */
const CLOUDINARY_HOST = /^res(?:-\d+)?\.cloudinary\.com$/i;

/** A path segment that is the asset version (`v1712345678`). */
const VERSION_SEGMENT = /^v\d+$/;

/** One transformation parameter (`w_400`, `c_limit`, `$var_1`, `fl_lossy`…). */
const TRANSFORMATION_PARAM = /^(?:[a-z]{1,4}_[^,/]*|\$[a-z0-9]+_[^,/]*)$/i;

/**
 * Parameters that only *optimise* an asset (format, quality, a width cap).
 * A component made of nothing else is replaced by our own optimisation; any
 * other component (a crop, an effect, an overlay) is an editorial choice and is
 * kept, with our optimisation chained after it.
 */
const OPTIMISATION_PARAM =
  /^(?:f_[a-z0-9]+|q_[a-z0-9:]+|w_\d+(?:\.\d+)?|h_\d+(?:\.\d+)?|c_(?:limit|scale|fit)|dpr_[\d.]+|fl_(?:progressive|lossy|awebp))$/i;

/** The pieces of a Cloudinary delivery URL. */
export interface CloudinaryUrlParts {
  /** `https://res.cloudinary.com` */
  origin: string;
  cloudName: string;
  resourceType: "image" | "video" | "raw";
  /** `upload`, `private`, `authenticated`, `fetch`… */
  deliveryType: string;
  /** Transformation components in URL order (`["c_fill,w_400", "f_auto"]`). */
  transformations: string[];
  /** `v1712345678`, when the URL carries one. */
  version: string | null;
  /** Decoded public id, folders included (`mukra/products/blue-hoodie-x1y2`). */
  publicId: string;
  /** File extension / delivery format (`jpg`), when present. */
  extension: string | null;
  /** Raw (still percent-encoded) id path including the extension. */
  idPath: string;
  /** Query string, kept verbatim when the URL is rebuilt. */
  search: string;
}

function isTransformationSegment(segment: string): boolean {
  return segment.split(",").every((param) => TRANSFORMATION_PARAM.test(param));
}

function isOptimisationSegment(segment: string): boolean {
  return segment.split(",").every((param) => OPTIMISATION_PARAM.test(param));
}

/**
 * Splits a Cloudinary delivery URL into its parts, or returns `null` for
 * anything that is not one (other hosts, relative paths, garbage).
 *
 * Handles transformation chains, missing versions and folder-style public ids:
 * `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_1920,c_limit/v17/mukra/products/a.jpg`
 * → `{ publicId: "mukra/products/a", version: "v17", extension: "jpg", … }`.
 */
export function parseCloudinaryUrl(value: string | null | undefined): CloudinaryUrlParts | null {
  if (typeof value !== "string" || !value.startsWith("http")) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !CLOUDINARY_HOST.test(url.hostname)) {
    return null;
  }

  const [cloudName, resourceType, deliveryType, ...rest] = url.pathname.split("/").filter(Boolean);
  if (!cloudName || !deliveryType || rest.length === 0) return null;
  if (resourceType !== "image" && resourceType !== "video" && resourceType !== "raw") return null;

  let transformations: string[];
  let version: string | null = null;
  let idSegments: string[];

  const versionIndex = rest.findIndex((segment) => VERSION_SEGMENT.test(segment));
  if (versionIndex >= 0) {
    transformations = rest.slice(0, versionIndex);
    version = rest[versionIndex] ?? null;
    idSegments = rest.slice(versionIndex + 1);
  } else {
    // No version: leading segments that parse as transformations are ones.
    let index = 0;
    while (index < rest.length - 1 && isTransformationSegment(rest[index] ?? "")) index += 1;
    transformations = rest.slice(0, index);
    idSegments = rest.slice(index);
  }
  if (idSegments.length === 0) return null;

  const idPath = idSegments.join("/");
  const extensionMatch = resourceType === "raw" ? null : /\.([a-z0-9]{2,5})$/i.exec(idPath);
  const extension = extensionMatch?.[1]?.toLowerCase() ?? null;
  const rawId = extensionMatch ? idPath.slice(0, -extensionMatch[0].length) : idPath;

  let publicId: string;
  try {
    publicId = decodeURIComponent(rawId);
  } catch {
    return null;
  }
  if (!publicId) return null;

  return {
    origin: `${url.protocol}//${url.host}`,
    cloudName,
    resourceType,
    deliveryType,
    transformations,
    version,
    publicId,
    extension,
    idPath,
    search: url.search,
  };
}

/** Reassembles a parsed URL with a new transformation chain. */
export function buildCloudinaryUrl(
  parts: CloudinaryUrlParts,
  transformations: readonly string[] = parts.transformations,
): string {
  const segments = [
    parts.cloudName,
    parts.resourceType,
    parts.deliveryType,
    ...transformations.filter(Boolean),
    ...(parts.version ? [parts.version] : []),
    parts.idPath,
  ];
  return `${parts.origin}/${segments.join("/")}${parts.search}`;
}

/** True for Cloudinary image/video delivery URLs (`res.cloudinary.com/…`). */
export function isCloudinaryUrl(url: string | null | undefined): boolean {
  return parseCloudinaryUrl(url) !== null;
}

/** Extracts the public id from a Cloudinary delivery URL (for deletes). */
export function publicIdFromUrl(url: string | null | undefined): string | null {
  return parseCloudinaryUrl(url)?.publicId ?? null;
}

/** Clamp a requested rendition width to something worth asking Cloudinary for. */
function deliveryWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return CLOUDINARY_MAX_WIDTH;
  return Math.max(1, Math.min(Math.round(width), CLOUDINARY_MAX_WIDTH));
}

/**
 * A Cloudinary image URL with `f_auto,q_auto,w_{width},c_limit` applied:
 * the CDN negotiates AVIF/WebP per browser, picks the quality, and caps the
 * width without ever upscaling or cropping.
 *
 * Existing optimisation-only transformations (an earlier `f_auto,q_auto,w_…`)
 * are replaced, so the URL never stacks resizes; editorial transformations
 * (crops, effects) are kept and the optimisation is chained after them.
 * Non-Cloudinary (and non-image) URLs come back untouched.
 */
export function cloudinaryImageUrl(url: string, width: number = CLOUDINARY_MAX_WIDTH): string {
  const parts = parseCloudinaryUrl(url);
  if (!parts || parts.resourceType !== "image" || parts.deliveryType === "fetch") return url;

  const editorial = parts.transformations.filter((segment) => !isOptimisationSegment(segment));
  const optimisation = `f_auto,q_auto,w_${deliveryWidth(width)},c_limit`;
  return buildCloudinaryUrl(parts, [...editorial, optimisation]);
}

/**
 * Rewrites a Cloudinary delivery URL with `f_auto,q_auto` and a width cap.
 * @deprecated Kept for existing callers — prefer `cloudinaryImageUrl`.
 */
export function optimizeUrl(url: string, width = 900): string {
  return cloudinaryImageUrl(url, width);
}

/**
 * `next/image` loader for Cloudinary sources.
 *
 * `next/image` calls it once per width in the generated `srcset`, so every
 * candidate is a direct CDN URL (`f_auto,q_auto,w_640,c_limit`, …) — the
 * browser downloads AVIF/WebP straight from Cloudinary instead of routing the
 * file through the Next.js image optimiser. `quality` is ignored on purpose:
 * `q_auto` picks it per image.
 */
export const cloudinaryLoader: ImageLoader = ({ src, width }) => cloudinaryImageUrl(src, width);

/* -------------------------------------------------------------------------- */
/*  Delivery strategy for next/image                                          */
/* -------------------------------------------------------------------------- */

/**
 * Remote hosts the Next.js optimiser may fetch. Must stay in sync with
 * `images.remotePatterns` in `next.config.ts` — any other host is rendered
 * `unoptimized` so a pasted URL can never crash the page.
 */
export const OPTIMIZED_REMOTE_HOSTS: readonly string[] = [
  "res.cloudinary.com",
  "images.unsplash.com",
  "images.pexels.com",
];

/** Props that make `next/image` deliver `src` the right way. */
export interface ImageDeliveryProps {
  /** Set for Cloudinary sources — srcset entries come straight from the CDN. */
  loader?: ImageLoader;
  /** Set when the Next.js optimiser can't (or shouldn't) fetch the file. */
  unoptimized?: boolean;
}

/**
 * How `next/image` should load `src`:
 *
 * - Cloudinary → custom loader (`f_auto,q_auto,w_{width},c_limit` srcset).
 * - Bundled `/public` paths and allow-listed hosts → the Next.js optimiser.
 * - Runtime `/uploads/…` files, `data:`/`blob:` URLs and unknown hosts →
 *   `unoptimized` (still lazy-loaded, never a remotePatterns error).
 */
export function imageDeliveryProps(src: string): ImageDeliveryProps {
  if (isCloudinaryUrl(src)) return { loader: cloudinaryLoader };
  if (src.startsWith("data:") || src.startsWith("blob:")) return { unoptimized: true };
  if (src.startsWith("/uploads/")) return { unoptimized: true };
  if (src.startsWith("/") && !src.startsWith("//")) return {};

  try {
    const { hostname } = new URL(src.startsWith("//") ? `https:${src}` : src);
    return OPTIMIZED_REMOTE_HOSTS.includes(hostname) ? {} : { unoptimized: true };
  } catch {
    return { unoptimized: true };
  }
}

/* -------------------------------------------------------------------------- */
/*  Renderability                                                             */
/* -------------------------------------------------------------------------- */

/**
 * True for anything the browser can load as an image.
 *
 * Legacy placeholder tokens (`"floral-summer-dress-1"`) fail this test, which
 * lets `ProductArtwork` choose its branded fallback.
 */
export function isRenderableImage(src: string | null | undefined): src is string {
  if (!src) return false;
  return (
    (src.startsWith("/") && !src.startsWith("//")) ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:image/") ||
    src.startsWith("blob:")
  );
}

/** Optimised single source (Cloudinary gets `f_auto,q_auto,w_…,c_limit`). */
export function imageSrc(src: string, width = 900): string {
  return isCloudinaryUrl(src) ? cloudinaryImageUrl(src, width) : src;
}

/** First renderable image in a product's `images` array, if any. */
export function firstRenderableImage(images: readonly string[] | undefined): string | undefined {
  return images?.find((entry) => isRenderableImage(entry));
}

const VIDEO_EXTENSION = /\.(?:mp4|webm|mov|m4v|ogv)$/i;
const IMAGE_EXTENSION = /\.(?:jpe?g|png|webp|avif|gif|svg)$/i;

/**
 * Best guess at what a media URL points to — used by the hero settings to stop
 * a video URL being saved as an image background (and vice versa).
 */
export function mediaKindFromUrl(url: string | null | undefined): "image" | "video" | "unknown" {
  if (!url) return "unknown";

  const cloudinary = parseCloudinaryUrl(url);
  if (cloudinary) {
    if (cloudinary.resourceType === "video") return "video";
    if (cloudinary.resourceType === "image") return "image";
    return "unknown";
  }

  const path = url.split(/[?#]/)[0] ?? "";
  if (VIDEO_EXTENSION.test(path)) return "video";
  if (IMAGE_EXTENSION.test(path) || url.startsWith("data:image/")) return "image";
  return "unknown";
}

/* -------------------------------------------------------------------------- */
/*  Cloudinary folders                                                         */
/* -------------------------------------------------------------------------- */

/**
 * @deprecated Admin folders now live in `lib/media.ts` (`MEDIA_FOLDERS`).
 * Kept so existing imports keep compiling.
 */
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
/*  Customer upload validation (`/api/upload` — payment / return evidence)      */
/* -------------------------------------------------------------------------- */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export interface FileValidation {
  ok: boolean;
  error?: string;
  kind: "image" | "video";
}

/** Client- and server-side guard for the customer upload endpoint. */
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
