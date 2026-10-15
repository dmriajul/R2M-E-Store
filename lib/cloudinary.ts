/**
 * Cloudinary — the configured v2 SDK instance plus upload/delete helpers.
 *
 * **Server-only.** This module holds the API secret; the `server-only` import
 * makes the Next.js build fail if a client component ever imports it. Browser
 * code uses the pure URL helpers in `lib/images.ts` instead, and every upload
 * goes through a route handler — the browser never talks to Cloudinary's API.
 *
 * Credentials come from `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and
 * `CLOUDINARY_API_SECRET`. Nothing here throws at import time when they are
 * missing: `isCloudinaryConfigured()` is `false` and callers fall back to the
 * local `.uploads/` disk store (demo mode).
 *
 * @example
 * import { cloudinary } from "@/lib/cloudinary";
 * const result = await cloudinary.uploader.upload(dataUri, { folder: "mukra/products" });
 */

import "server-only";
import {
  v2 as cloudinary,
  type ConfigOptions,
  type UploadApiOptions,
  type UploadApiResponse,
} from "cloudinary";
import { isCloudinaryConfigured } from "@/lib/demo-mode";
import { PRODUCT_FOLDER, isCloudinaryUrl, optimizeUrl } from "@/lib/images";

/* -------------------------------------------------------------------------- */
/*  Configuration                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Only *defined* values are passed to `config()`: the SDK merges, so an
 * `undefined` key would wipe a value it already read from `CLOUDINARY_URL`.
 * Values are trimmed because dashboard copy/paste often brings a newline.
 */
function configFromEnv(): ConfigOptions {
  const config: ConfigOptions = { secure: true };
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (cloudName) config.cloud_name = cloudName;
  if (apiKey) config.api_key = apiKey;
  if (apiSecret) config.api_secret = apiSecret;
  return config;
}

cloudinary.config(configFromEnv());

/** The configured Cloudinary v2 SDK — ready to use on the server. */
export { cloudinary, isCloudinaryConfigured };
export default cloudinary;

/** The cloud name in use (for logs and health output — never the secret). */
export function cloudinaryCloudName(): string | null {
  const name = cloudinary.config().cloud_name;
  return typeof name === "string" && name ? name : null;
}

/* -------------------------------------------------------------------------- */
/*  Errors                                                                    */
/* -------------------------------------------------------------------------- */

/** A failed Cloudinary call, with the HTTP status Cloudinary reported. */
export class CloudinaryError extends Error {
  readonly httpCode: number | null;

  constructor(message: string, httpCode: number | null = null) {
    super(message);
    this.name = "CloudinaryError";
    this.httpCode = httpCode;
  }
}

function toCloudinaryError(error: unknown): CloudinaryError {
  if (error instanceof CloudinaryError) return error;
  if (error && typeof error === "object") {
    const record = error as { message?: unknown; http_code?: unknown; error?: unknown };
    // The SDK sometimes nests the real error: `{ error: { message, http_code } }`.
    const inner =
      record.error && typeof record.error === "object"
        ? (record.error as { message?: unknown; http_code?: unknown })
        : record;
    const message = typeof inner.message === "string" ? inner.message : "Cloudinary request failed";
    const httpCode = typeof inner.http_code === "number" ? inner.http_code : null;
    return new CloudinaryError(message, httpCode);
  }
  return new CloudinaryError(typeof error === "string" ? error : "Cloudinary request failed");
}

/* -------------------------------------------------------------------------- */
/*  Upload / delete                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Streams a buffer to Cloudinary (`upload_stream`), resolving with the stored
 * asset. Rejects with a `CloudinaryError` — callers decide what to tell users.
 */
export function uploadBuffer(buffer: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) {
        reject(toCloudinaryError(error ?? "Cloudinary returned an empty response"));
        return;
      }
      resolve(result);
    });
    stream.on("error", (error: unknown) => reject(toCloudinaryError(error)));
    stream.end(buffer);
  });
}

/**
 * Deletes an image and purges it from the CDN cache.
 * Resolves `"ok"` or `"not found"` (already gone counts as done); anything
 * else rejects with a `CloudinaryError`.
 */
export async function destroyImage(publicId: string): Promise<"ok" | "not found"> {
  let response: unknown;
  try {
    response = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      type: "upload",
      invalidate: true,
    });
  } catch (error) {
    throw toCloudinaryError(error);
  }

  const result = (response as { result?: unknown } | null)?.result;
  if (result === "ok" || result === "not found") return result;
  throw new CloudinaryError(`Cloudinary could not delete ${publicId} (${String(result ?? "no result")})`);
}

/* -------------------------------------------------------------------------- */
/*  Legacy helpers — used by `/api/upload` (customer proofs, hero videos)      */
/* -------------------------------------------------------------------------- */

/* Re-exported so older server callers keep compiling. */
export { PRODUCT_FOLDER, isCloudinaryUrl, optimizeUrl };

export interface UploadedAsset {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  provider: "cloudinary" | "local";
}

/**
 * Uploads a buffer to Cloudinary for the legacy `/api/upload` route.
 * @returns the asset, or `null` when Cloudinary is not configured or failed
 *          (that route falls back to local disk).
 */
export async function uploadToCloudinary(
  file: { buffer: Buffer; mimetype: string; originalName: string },
  folder: string = PRODUCT_FOLDER,
  resourceType: "image" | "video" = "image",
): Promise<UploadedAsset | null> {
  if (!isCloudinaryConfigured()) return null;

  const safeName = file.originalName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 60);

  try {
    const result = await uploadBuffer(file.buffer, {
      folder,
      resource_type: resourceType,
      public_id: `${Date.now()}-${safeName || "asset"}`,
      ...(resourceType === "image"
        ? { transformation: [{ width: 1400, height: 1400, crop: "limit", quality: "auto:good" }] }
        : {}),
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format,
      provider: "cloudinary",
    };
  } catch (error) {
    console.error("[cloudinary] upload failed:", toCloudinaryError(error).message);
    return null;
  }
}

/** Removes an asset. Returns false when Cloudinary is unavailable or failed. */
export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  if (!isCloudinaryConfigured() || !publicId) return false;

  try {
    await destroyImage(publicId);
    return true;
  } catch (error) {
    console.error("[cloudinary] delete failed:", toCloudinaryError(error).message);
    return false;
  }
}
