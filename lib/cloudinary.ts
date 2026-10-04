/**
 * Cloudinary wrapper.
 *
 * Uploads go to Cloudinary when the three env keys are present; otherwise the
 * caller's local-disk fallback takes over (`/public/uploads`). Nothing in this
 * file throws just because Cloudinary is unconfigured.
 */

import { isCloudinaryConfigured } from "@/lib/demo-mode";
import { MODEL_FOLDER, PRODUCT_FOLDER, isCloudinaryUrl, optimizeUrl } from "@/lib/images";

/**
 * The SDK is imported lazily — and only as a *type* up here — because it is
 * Node-only. Keeping it out of the runtime module graph lets client components
 * import the URL helpers above (through `lib/images.ts`) without dragging the
 * SDK into the browser bundle.
 */
import type { v2 as CloudinaryV2 } from "cloudinary";

type CloudinarySdk = typeof CloudinaryV2;

let sdk: CloudinarySdk | null = null;

async function cloudinarySdk(): Promise<CloudinarySdk | null> {
  if (sdk) return sdk;
  try {
    const mod = await import("cloudinary");
    sdk = mod.v2;
    return sdk;
  } catch {
    return null;
  }
}

/* Re-exported so server callers can keep importing them from here. */
export { isCloudinaryUrl, optimizeUrl };

/* Folder constants live in `lib/images.ts`; re-exported for server callers. */
export { MODEL_FOLDER, PRODUCT_FOLDER };

export interface UploadedAsset {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  provider: "cloudinary" | "local";
}

let configured = false;

async function configure(): Promise<CloudinarySdk | null> {
  const instance = await cloudinarySdk();
  if (!instance || !isCloudinaryConfigured()) return null;

  if (!configured) {
    instance.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }

  return instance;
}

/**
 * Uploads a buffer to Cloudinary.
 * @returns the asset, or `null` when Cloudinary is not configured/failed.
 */
export async function uploadToCloudinary(
  file: { buffer: Buffer; mimetype: string; originalName: string },
  folder: string = PRODUCT_FOLDER,
): Promise<UploadedAsset | null> {
  const client = await configure();
  if (!client) return null;

  const resourceType = folder === MODEL_FOLDER ? "raw" : "image";
  const safeName = file.originalName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 60);

  return new Promise<UploadedAsset | null>((resolve) => {
    const stream = client.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: `${Date.now()}-${safeName || "asset"}`,
        // Images are cropped to a friendly product ratio; models pass through.
        ...(resourceType === "image"
          ? { transformation: [{ width: 1400, height: 1400, crop: "limit", quality: "auto:good" }] }
          : {}),
      },
      (error, result) => {
        if (error || !result) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[cloudinary] upload failed:", error?.message ?? "unknown error");
          }
          resolve(null);
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          format: result.format,
          provider: "cloudinary",
        });
      },
    );

    stream.end(file.buffer);
  });
}

/** Removes an asset. Silently returns false when Cloudinary is unavailable. */
export async function deleteFromCloudinary(
  publicId: string,
  folder: string = PRODUCT_FOLDER,
): Promise<boolean> {
  const client = await configure();
  if (!client || !publicId) return false;

  try {
    const result = await client.uploader.destroy(publicId, {
      resource_type: folder === MODEL_FOLDER ? "raw" : "image",
      invalidate: true,
    });
    return result.result === "ok" || result.result === "not found";
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[cloudinary] delete failed:", error instanceof Error ? error.message : error);
    }
    return false;
  }
}

/* URL helpers live in `lib/images.ts` and are re-exported at the top. */
