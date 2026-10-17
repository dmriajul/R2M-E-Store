/**
 * Console media rules — shared by the upload API (`app/api/admin/upload`) and
 * the admin upload widgets (`components/admin/ImageUpload.tsx`).
 *
 * Client-safe: no Node APIs, no secrets. The browser runs the same checks for
 * instant feedback, but they are UX only — the server repeats every one of
 * them and adds a magic-byte sniff before a single byte reaches Cloudinary.
 */

import type { AdminPermission } from "@/lib/rbac";
import {
  CLOUDINARY_MAX_WIDTH,
  humanFileSize,
  parseCloudinaryUrl,
} from "@/lib/images";

/* -------------------------------------------------------------------------- */
/*  Folders                                                                   */
/* -------------------------------------------------------------------------- */

/** Cloudinary folder for each upload destination. */
export const MEDIA_FOLDERS = {
  products: "mukra/products",
  categories: "mukra/categories",
  banners: "mukra/banners",
} as const;

/** Upload destination — also the local `.uploads/<folder>` bucket name. */
export type MediaFolder = keyof typeof MEDIA_FOLDERS;

export const MEDIA_FOLDER_NAMES = Object.keys(MEDIA_FOLDERS) as readonly MediaFolder[];

/**
 * The permission that owns each folder. `/api/admin/upload` requires
 * `media:upload` *and* this, so an SEO manager can replace the homepage banner
 * but not a product photo, and an inventory manager the reverse.
 */
export const MEDIA_FOLDER_PERMISSIONS: Readonly<Record<MediaFolder, AdminPermission>> = {
  products: "products:write",
  categories: "categories:write",
  banners: "settings:write",
};

/** Human copy for toasts ("Uploaded to mukra/products"). */
export const MEDIA_FOLDER_LABELS: Readonly<Record<MediaFolder, string>> = {
  products: "product photos",
  categories: "category covers",
  banners: "homepage banners",
};

/** Accepts `products`, `mukra/products` or `/mukra/products/`. */
export function parseMediaFolder(value: unknown): MediaFolder | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  const name = trimmed.startsWith("mukra/") ? trimmed.slice("mukra/".length) : trimmed;
  return (MEDIA_FOLDER_NAMES as readonly string[]).includes(name) ? (name as MediaFolder) : null;
}

/* -------------------------------------------------------------------------- */
/*  Limits                                                                    */
/* -------------------------------------------------------------------------- */

/** Hard upload ceiling (5 MB) — enforced in the browser *and* the route. */
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;

/** Stored images are capped at this width at upload time (`c_limit`). */
export const MEDIA_MAX_WIDTH = CLOUDINARY_MAX_WIDTH;

/**
 * Delivery transformation baked into the URL the upload API returns. Format
 * negotiation happens here, at delivery — Cloudinary rejects `f_auto` as an
 * upload-time (incoming) transformation.
 */
export const MEDIA_DELIVERY_TRANSFORMATION = `f_auto,q_auto,w_${MEDIA_MAX_WIDTH},c_limit`;

/** Photos per product in the console gallery. */
export const PRODUCT_GALLERY_LIMIT = 5;

/**
 * Server-side cap on `Product.images`. Deliberately looser than the gallery so
 * an older product with a few extra photos can still be saved.
 */
export const PRODUCT_IMAGES_MAX = 10;

/* -------------------------------------------------------------------------- */
/*  File types                                                                */
/* -------------------------------------------------------------------------- */

export const MEDIA_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export type MediaImageType = (typeof MEDIA_IMAGE_TYPES)[number];

/** Canonical extension (and Cloudinary format) per type. */
export const MEDIA_IMAGE_EXTENSIONS: Readonly<Record<MediaImageType, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Cloudinary `allowed_formats` — Cloudinary calls JPEG `jpg`. */
export const MEDIA_CLOUDINARY_FORMATS = ["jpg", "png", "webp", "avif"] as const;

/** `accept` attribute for file inputs (MIME types plus extensions for picky OSes). */
export const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif";

/** Copy used in hints and errors. */
export const MEDIA_TYPES_LABEL = "JPG, PNG, WebP or AVIF";

const TYPE_ALIASES: Readonly<Record<string, MediaImageType>> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
};

const EXTENSION_TYPES: Readonly<Record<string, MediaImageType>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export function isMediaImageType(value: string): value is MediaImageType {
  return (MEDIA_IMAGE_TYPES as readonly string[]).includes(value);
}

/**
 * The type a file *claims* to be: its MIME type, or — when the OS reports
 * nothing useful, which is common for AVIF — its extension. `null` means it
 * claims to be something we don't accept (PDF, GIF, SVG, HEIC…).
 */
export function declaredImageType(file: { name: string; type: string }): MediaImageType | null {
  const type = file.type.trim().toLowerCase();
  if (isMediaImageType(type)) return type;
  if (TYPE_ALIASES[type]) return TYPE_ALIASES[type];
  if (type && type !== "application/octet-stream") return null;

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[extension] ?? null;
}

export type MediaValidation =
  | { ok: true; type: MediaImageType }
  | { ok: false; status: 400 | 413 | 415; error: string };

/**
 * Size + type guard used by the uploader (instant feedback) and the route.
 *
 * @param maxBytes optional tighter limit; it can never exceed `MEDIA_MAX_BYTES`.
 */
export function validateMediaFile(
  file: { name: string; type: string; size: number },
  maxBytes: number = MEDIA_MAX_BYTES,
): MediaValidation {
  const limit = Math.min(Math.max(1, maxBytes), MEDIA_MAX_BYTES);
  const name = file.name || "This file";

  const type = declaredImageType(file);
  if (!type) {
    return {
      ok: false,
      status: 415,
      error: `${name} isn't a supported image. Upload a ${MEDIA_TYPES_LABEL} file.`,
    };
  }
  if (file.size <= 0) {
    return { ok: false, status: 400, error: `${name} is empty.` };
  }
  if (file.size > limit) {
    return {
      ok: false,
      status: 413,
      error: `${name} is ${humanFileSize(file.size)} — images must be ${humanFileSize(limit)} or smaller.`,
    };
  }
  return { ok: true, type };
}

/* -------------------------------------------------------------------------- */
/*  Content sniffing (server)                                                 */
/* -------------------------------------------------------------------------- */

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function uint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function uint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function uint24LE(bytes: Uint8Array, offset: number): number {
  return uint16LE(bytes, offset) | ((bytes[offset + 2] ?? 0) << 16);
}

function uint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) >>> 0) +
    (((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0))
  );
}

/**
 * Identifies an image by its leading bytes, ignoring what the client claimed.
 *
 * The route only forwards files that sniff as JPEG, PNG, WebP or AVIF — a PDF
 * renamed to `.png` is refused here (Cloudinary would otherwise happily accept
 * a PDF as an "image" resource).
 */
export function sniffImageType(bytes: Uint8Array): MediaImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && PNG.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }

  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return "image/webp";
  }

  // AVIF is an ISO-BMFF file: an `ftyp` box whose brands include avif/avis.
  if (bytes.length >= 16 && ascii(bytes, 4, 8) === "ftyp") {
    const boxEnd = Math.min(bytes.length, Math.max(16, uint32BE(bytes, 0)), 64);
    const brands = [ascii(bytes, 8, 12)];
    for (let offset = 16; offset + 4 <= boxEnd; offset += 4) brands.push(ascii(bytes, offset, offset + 4));
    if (brands.includes("avif") || brands.includes("avis")) return "image/avif";
  }

  return null;
}

/** Pixel size read from the file header, or `null` when it can't be parsed. */
export function readImageDimensions(
  bytes: Uint8Array,
  type: MediaImageType,
): { width: number; height: number } | null {
  const valid = (width: number, height: number) =>
    width > 0 && height > 0 ? { width, height } : null;

  switch (type) {
    case "image/png":
      // IHDR is always the first chunk: width/height at bytes 16-23.
      return bytes.length >= 24 && ascii(bytes, 12, 16) === "IHDR"
        ? valid(uint32BE(bytes, 16), uint32BE(bytes, 20))
        : null;

    case "image/jpeg": {
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) return null;
        const marker = bytes[offset + 1] ?? 0;
        if (marker === 0xff) {
          offset += 1; // fill byte
          continue;
        }
        // Standalone markers carry no length.
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
          offset += 2;
          continue;
        }
        const isStartOfFrame =
          marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isStartOfFrame) {
          return valid(uint16BE(bytes, offset + 7), uint16BE(bytes, offset + 5));
        }
        offset += 2 + uint16BE(bytes, offset + 2);
      }
      return null;
    }

    case "image/webp": {
      if (bytes.length < 30 || ascii(bytes, 8, 12) !== "WEBP") return null;
      const chunk = ascii(bytes, 12, 16);
      if (chunk === "VP8 ") {
        return valid(uint16LE(bytes, 26) & 0x3fff, uint16LE(bytes, 28) & 0x3fff);
      }
      if (chunk === "VP8L") {
        const b1 = bytes[22] ?? 0;
        const b2 = bytes[23] ?? 0;
        const b3 = bytes[24] ?? 0;
        const b0 = bytes[21] ?? 0;
        return valid(1 + (((b1 & 0x3f) << 8) | b0), 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)));
      }
      if (chunk === "VP8X") {
        return valid(1 + uint24LE(bytes, 24), 1 + uint24LE(bytes, 27));
      }
      return null;
    }

    case "image/avif": {
      // The `ispe` (image spatial extents) property: size, "ispe", version/flags, w, h.
      // Several can exist (thumbnails, alpha planes) — the largest is the image.
      let best: { width: number; height: number } | null = null;
      const limit = Math.min(bytes.length - 16, 256 * 1024);
      for (let index = 4; index < limit; index += 1) {
        if (bytes[index] === 0x69 && ascii(bytes, index, index + 4) === "ispe") {
          const candidate = valid(uint32BE(bytes, index + 8), uint32BE(bytes, index + 12));
          if (candidate && (!best || candidate.width * candidate.height > best.width * best.height)) {
            best = candidate;
          }
        }
      }
      return best;
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Public ids                                                                */
/* -------------------------------------------------------------------------- */

/** `mukra/<folder>/<id>` — ids we generate (and the legacy `<timestamp>-<name>`). */
const CLOUDINARY_ID = /^mukra\/(products|categories|banners)\/[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;

/** `local:<folder>/<file>.<ext>` — the local-disk fallback. */
const LOCAL_ID = /^local:(products|categories|banners)\/[A-Za-z0-9][A-Za-z0-9_-]{0,159}\.(?:jpe?g|png|webp|avif)$/i;

/** `/uploads/<folder>/<file>.<ext>` — the URL of a local fallback file. */
const LOCAL_URL = /^\/uploads\/(products|categories|banners)\/([A-Za-z0-9][A-Za-z0-9_-]{0,159}\.(?:jpe?g|png|webp|avif))$/i;

/**
 * The folder a public id belongs to, when it is one the console manages.
 * Anything else — other folders, path tricks (`local:../../.env`), customer
 * payment proofs — returns `null` and can never be deleted through the API.
 */
export function managedFolderForPublicId(publicId: string): MediaFolder | null {
  const match = CLOUDINARY_ID.exec(publicId) ?? LOCAL_ID.exec(publicId);
  return match ? (match[1] as MediaFolder) : null;
}

/**
 * The managed public id behind a stored image URL (Cloudinary delivery URL or
 * `/uploads/…` path), or `null` for external / unmanaged images.
 */
export function managedPublicIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const local = LOCAL_URL.exec(url);
  if (local) return `local:${local[1]}/${local[2]}`;

  const parts = parseCloudinaryUrl(url);
  if (!parts || parts.resourceType !== "image" || parts.deliveryType !== "upload") return null;
  return managedFolderForPublicId(parts.publicId) ? parts.publicId : null;
}

/**
 * A Cloudinary-safe, SEO-friendly id stem from an original file name:
 * `"Blue Hoodie (Front).JPG"` → `"blue-hoodie-front"`.
 */
export function mediaNameStem(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop() ?? "";
  const stem = baseName
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return stem || "image";
}
