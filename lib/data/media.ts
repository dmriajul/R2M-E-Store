/**
 * Console media service — the server half of the image pipeline.
 *
 * - `storeAdminImage()` validates an upload (declared type, size and the
 *   file's magic bytes) and stores it in Cloudinary under `mukra/<folder>/`,
 *   or on local disk when Cloudinary is not configured (demo mode).
 * - `removeAdminImage()` deletes a managed asset by public id. Ids are checked
 *   against a strict pattern first, so it can never reach customer payment
 *   proofs, other folders, or escape the `.uploads/` directory.
 * - `countImageReferences()` / `scheduleImageCleanup()` keep the media library
 *   tidy: after a product, category or banner is saved or deleted, images the
 *   record no longer uses are deleted — unless any other record still does.
 *
 * Errors that are safe to show the operator are thrown as `MediaError`, which
 * carries the HTTP status the route should answer with.
 */

import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { after } from "next/server";
import type { UploadApiResponse } from "cloudinary";
import {
  CloudinaryError,
  destroyImage,
  isCloudinaryConfigured,
  uploadBuffer,
} from "@/lib/cloudinary";
import {
  buildCloudinaryUrl,
  cloudinaryImageUrl,
  parseCloudinaryUrl,
} from "@/lib/images";
import {
  MEDIA_CLOUDINARY_FORMATS,
  MEDIA_DELIVERY_TRANSFORMATION,
  MEDIA_FOLDER_PERMISSIONS,
  MEDIA_FOLDERS,
  MEDIA_IMAGE_EXTENSIONS,
  MEDIA_MAX_WIDTH,
  MEDIA_TYPES_LABEL,
  managedFolderForPublicId,
  managedPublicIdFromUrl,
  mediaNameStem,
  readImageDimensions,
  sniffImageType,
  validateMediaFile,
  type MediaFolder,
  type MediaImageType,
} from "@/lib/media";
import { getPrisma, type PrismaDelegate } from "@/lib/prisma";
import { ADMIN_ROLE_LABEL, hasPermission } from "@/lib/rbac";
import { UPLOAD_ROOT, UPLOAD_URL_PREFIX } from "@/lib/uploads";
import type { AdminRole, AdminUploadResult } from "@/types";

/** An error whose message is safe to show the operator, plus the HTTP status. */
export class MediaError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MediaError";
    this.status = status;
  }
}

/**
 * Throws a 403 `MediaError` unless `role` owns `folder` (products and
 * categories belong to inventory, banners to SEO — see `lib/media.ts`).
 * The route has already required `media:upload`; this narrows it per folder.
 */
export function assertFolderPermission(role: AdminRole, folder: MediaFolder): void {
  if (!hasPermission(role, MEDIA_FOLDER_PERMISSIONS[folder])) {
    throw new MediaError(
      `${ADMIN_ROLE_LABEL[role]} accounts can't manage images in ${MEDIA_FOLDERS[folder]}/.`,
      403,
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Upload                                                                    */
/* -------------------------------------------------------------------------- */

/** `blue-hoodie-m2k9x1a3f0c2` — readable, unique, and never contains a slash. */
function uniqueId(fileName: string): string {
  return `${mediaNameStem(fileName)}-${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
}

/**
 * Validates and stores one console image.
 *
 * @throws {MediaError} 400/413/415 for bad files, 422/502/503/504 when
 *         Cloudinary (or the disk fallback) can't take it.
 */
export async function storeAdminImage(file: File, folder: MediaFolder): Promise<AdminUploadResult> {
  const check = validateMediaFile(file);
  if (!check.ok) throw new MediaError(check.error, check.status);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) {
    throw new MediaError(
      `${file.name || "This file"} isn't a real ${MEDIA_TYPES_LABEL} image — its contents don't match an image format.`,
      415,
    );
  }

  const id = uniqueId(file.name);
  return isCloudinaryConfigured()
    ? storeInCloudinary(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), folder, id)
    : storeLocally(bytes, folder, type, id);
}

async function storeInCloudinary(
  buffer: Buffer,
  folder: MediaFolder,
  id: string,
): Promise<AdminUploadResult> {
  let result: UploadApiResponse;
  try {
    result = await uploadBuffer(buffer, {
      // `folder` works in both fixed and dynamic folder modes: the asset lands
      // in the folder and its public id becomes `mukra/<folder>/<id>`.
      folder: MEDIA_FOLDERS[folder],
      public_id: id,
      resource_type: "image",
      overwrite: false,
      unique_filename: false,
      use_filename: false,
      allowed_formats: [...MEDIA_CLOUDINARY_FORMATS],
      // Incoming transformation: the stored original is capped at 1920px
      // (c_limit never upscales or crops) with automatic quality. `f_auto`
      // can't run at upload time, so format negotiation is applied to the
      // delivery URL instead (`MEDIA_DELIVERY_TRANSFORMATION`).
      transformation: [{ width: MEDIA_MAX_WIDTH, crop: "limit", quality: "auto" }],
      tags: ["mukra-admin", `mukra-${folder}`],
      timeout: 60_000,
    });
  } catch (error) {
    throw cloudinaryFailure(error, "upload");
  }

  if (!result.public_id.startsWith(`${MEDIA_FOLDERS[folder]}/`)) {
    console.warn(
      `[media] Cloudinary stored ${result.public_id} outside ${MEDIA_FOLDERS[folder]}/ — check the account's folder mode / upload defaults.`,
    );
  }

  return {
    url: cloudinaryImageUrl(result.secure_url, MEDIA_MAX_WIDTH),
    publicId: result.public_id,
    width: typeof result.width === "number" ? result.width : null,
    height: typeof result.height === "number" ? result.height : null,
    format: result.format,
    size: result.bytes,
  };
}

/**
 * Demo-mode fallback: writes to `.uploads/<folder>/` (served by
 * `app/uploads/[...path]`). Files are stored as uploaded — no resize.
 */
async function storeLocally(
  bytes: Uint8Array,
  folder: MediaFolder,
  type: MediaImageType,
  id: string,
): Promise<AdminUploadResult> {
  const extension = MEDIA_IMAGE_EXTENSIONS[type];
  const fileName = `${id}.${extension}`;
  const directory = path.join(UPLOAD_ROOT, folder);

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, fileName), bytes, { flag: "wx" });
  } catch (error) {
    console.error("[media] local upload failed:", error);
    throw new MediaError(
      "Cloudinary isn't configured and this server can't store files locally (Vercel's disk is read-only). Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
      503,
    );
  }

  const dimensions = readImageDimensions(bytes, type);
  return {
    url: `${UPLOAD_URL_PREFIX}/${folder}/${fileName}`,
    publicId: `local:${folder}/${fileName}`,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    format: extension,
    size: bytes.byteLength,
  };
}

/** Maps a Cloudinary failure to something the operator can act on. */
function cloudinaryFailure(error: unknown, action: "upload" | "delete"): MediaError {
  const failure =
    error instanceof CloudinaryError ? error : new CloudinaryError(String(error ?? "unknown error"));
  console.error(`[media] Cloudinary ${action} failed (${failure.httpCode ?? "no status"}):`, failure.message);

  const code = failure.httpCode;
  if (code === 401 || code === 403) {
    return new MediaError(
      "Cloudinary rejected the API credentials — check CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
      502,
    );
  }
  if (code === 420 || code === 429) {
    return new MediaError("Cloudinary's rate limit was reached — try again in a minute.", 503);
  }
  if (code === 499 || /timeout|timed out/i.test(failure.message)) {
    return new MediaError("Cloudinary took too long to respond — try again.", 504);
  }
  if (code === 400 && action === "upload") {
    return /format/i.test(failure.message)
      ? new MediaError(`Cloudinary refused this file type. Upload a ${MEDIA_TYPES_LABEL} image.`, 415)
      : new MediaError(`Cloudinary couldn't process this image (${failure.message}).`, 422);
  }
  return new MediaError(
    action === "upload" ? "The upload to Cloudinary failed — try again." : "Cloudinary couldn't delete the image — try again.",
    502,
  );
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                    */
/* -------------------------------------------------------------------------- */

export interface RemoveResult {
  publicId: string;
  /** `not-found` means it was already gone — still a success. */
  result: "deleted" | "not-found";
}

/**
 * Deletes a managed image by public id (`mukra/<folder>/<id>` on Cloudinary,
 * `local:<folder>/<file>` on disk). Does **not** check permissions or
 * references — callers do that first.
 *
 * @throws {MediaError} 400 for ids outside the managed folders, 503 when
 *         Cloudinary isn't configured, 502/504 when the delete fails.
 */
export async function removeAdminImage(publicId: string): Promise<RemoveResult> {
  if (!managedFolderForPublicId(publicId)) {
    throw new MediaError(
      "Only console images (mukra/products, mukra/categories, mukra/banners) can be deleted.",
      400,
    );
  }

  if (publicId.startsWith("local:")) return removeLocalFile(publicId);

  if (!isCloudinaryConfigured()) {
    throw new MediaError("Cloudinary isn't configured, so Cloudinary images can't be deleted from here.", 503);
  }

  try {
    const outcome = await destroyImage(publicId);
    return { publicId, result: outcome === "ok" ? "deleted" : "not-found" };
  } catch (error) {
    throw cloudinaryFailure(error, "delete");
  }
}

async function removeLocalFile(publicId: string): Promise<RemoveResult> {
  const root = path.resolve(UPLOAD_ROOT);
  const target = path.resolve(root, publicId.slice("local:".length));
  // The id pattern already forbids `..` and nested paths; this is the backstop.
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new MediaError("Invalid public id", 400);
  }

  try {
    await unlink(target);
    return { publicId, result: "deleted" };
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
      return { publicId, result: "not-found" };
    }
    console.error("[media] local delete failed:", error);
    throw new MediaError("The local file couldn't be deleted.", 500);
  }
}

/**
 * The whole console delete, shared by `DELETE /api/admin/upload` and the
 * legacy `DELETE /api/upload`:
 *
 * 1. the id must be a managed one (`mukra/<folder>/…` / `local:<folder>/…`);
 * 2. `role` must own that folder;
 * 3. an optional `url` must point at the same asset;
 * 4. no saved record may still use the image (409 otherwise) — if the
 *    database can't answer, the image is kept (503, fail closed);
 * 5. then it is deleted from Cloudinary (or disk).
 */
export async function deleteManagedImage(
  role: AdminRole,
  target: { publicId: string; url?: string | null },
): Promise<RemoveResult> {
  const publicId = target.publicId.trim();
  const folder = managedFolderForPublicId(publicId);
  if (!folder) {
    throw new MediaError(
      "Only console images (mukra/products, mukra/categories, mukra/banners) can be deleted.",
      400,
    );
  }
  assertFolderPermission(role, folder);

  const url = target.url?.trim() || null;
  if (url && managedPublicIdFromUrl(url) !== publicId) {
    throw new MediaError("The url and publicId don't refer to the same image.", 400);
  }

  let references: number;
  try {
    references = await countImageReferences({ publicId, url });
  } catch (error) {
    console.error(`[media] reference check failed for ${publicId}:`, error);
    throw new MediaError("Couldn't confirm the image is unused, so it was kept — try again.", 503);
  }
  if (references > 0) {
    throw new MediaError(
      `This image is still used by ${references} saved record${references === 1 ? "" : "s"}, so it was kept. Remove it there and save first.`,
      409,
    );
  }

  return removeAdminImage(publicId);
}

/* -------------------------------------------------------------------------- */
/*  References                                                                */
/* -------------------------------------------------------------------------- */

/** The URL forms the same Cloudinary asset may have been saved under. */
function urlVariants(url: string): string[] {
  const variants = new Set([url]);
  const parts = parseCloudinaryUrl(url);
  if (parts) {
    const bare = { ...parts, search: "" };
    variants.add(buildCloudinaryUrl(bare, []));
    variants.add(buildCloudinaryUrl(bare, [MEDIA_DELIVERY_TRANSFORMATION]));
  }
  return [...variants];
}

/** Rows with a string-array column, for the url-less reference scan. */
interface ImagesRow {
  images: string[];
}

/**
 * How many saved records still use an image: product galleries, category
 * covers and the homepage banner — plus order payment proofs and return
 * photos, so customer evidence is never deleted.
 *
 * `url` makes the array checks exact (`hasSome`); without it they fall back to
 * scanning for the public id. Returns 0 without a database (nothing persists).
 *
 * @throws when the database can't answer — callers must fail closed.
 */
export async function countImageReferences(target: {
  publicId: string;
  url?: string | null;
}): Promise<number> {
  const db = await getPrisma();
  if (!db) return 0;

  const isLocal = target.publicId.startsWith("local:");
  const needle = isLocal
    ? `${UPLOAD_URL_PREFIX}/${target.publicId.slice("local:".length)}`
    : target.publicId;
  const knownUrl = target.url ?? (isLocal ? needle : null);

  const arrayReferences = async (delegate: PrismaDelegate): Promise<number> => {
    if (knownUrl) {
      return delegate.count({ where: { images: { hasSome: urlVariants(knownUrl) } } });
    }
    const rows = (await delegate.findMany({
      where: { images: { isEmpty: false } },
      select: { images: true },
    })) as ImagesRow[];
    return rows.filter((row) => row.images.some((image) => image.includes(needle))).length;
  };

  const counts = await Promise.all([
    arrayReferences(db.product),
    db.category.count({ where: { image: { contains: needle } } }),
    db.siteSettings.count({ where: { heroMediaUrl: { contains: needle } } }),
    db.order.count({ where: { paymentRef: { contains: needle } } }),
    arrayReferences(db.returnRequest),
  ]);

  return counts.reduce((total, count) => total + count, 0);
}

/* -------------------------------------------------------------------------- */
/*  Cleanup after saves / deletes                                              */
/* -------------------------------------------------------------------------- */

async function cleanupDetachedImages(urls: readonly string[]): Promise<void> {
  for (const url of urls) {
    const publicId = managedPublicIdFromUrl(url);
    if (!publicId) continue;

    try {
      if ((await countImageReferences({ publicId, url })) > 0) continue;
      if (!publicId.startsWith("local:") && !isCloudinaryConfigured()) continue;
      await removeAdminImage(publicId);
    } catch (error) {
      // Best effort: an orphaned file is far better than a failed save.
      console.error(
        `[media] cleanup skipped for ${publicId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

/**
 * Deletes the console images a record stopped using — call it **after** the
 * write has committed, with the record's images before and after.
 *
 * Only managed images (`mukra/products|categories|banners`, or their local
 * equivalents) that no saved record references any more are removed. It runs
 * after the response is sent (`after()`), never throws, and never delays or
 * fails the save that triggered it.
 */
export function scheduleImageCleanup(
  previous: Iterable<string | null | undefined>,
  next: Iterable<string | null | undefined> = [],
): void {
  const kept = new Set<string>();
  for (const url of next) {
    const publicId = managedPublicIdFromUrl(url);
    if (publicId) kept.add(publicId);
  }

  const detached = new Map<string, string>();
  for (const url of previous) {
    const publicId = managedPublicIdFromUrl(url);
    if (url && publicId && !kept.has(publicId) && !detached.has(publicId)) detached.set(publicId, url);
  }
  if (detached.size === 0) return;

  const task = () => cleanupDetachedImages([...detached.values()]);
  try {
    after(task);
  } catch {
    // Outside a request scope (scripts, tests): just run it.
    void task();
  }
}
