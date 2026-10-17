/**
 * Public upload endpoint.
 *
 * - **Customer evidence** — payment screenshots at checkout (guests included)
 *   and return-request photos. Stored in `mukra/payments` / `mukra/returns`
 *   (`folder` form field), never in the console's managed folders, so the
 *   console's delete endpoint can't reach them.
 * - **Hero media** — `?purpose=hero` (images *or* videos), `settings:write`
 *   only, stored in `mukra/hero`. The hero *image* picker now uses
 *   `/api/admin/upload`; this path remains for background videos.
 *
 * Console images (products, categories, banners) go through
 * `POST /api/admin/upload` instead. Responses keep the `ApiResponse` envelope.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { auth, requireActionRole } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { MediaError, deleteManagedImage } from "@/lib/data/media";
import { isCloudinaryConfigured } from "@/lib/integrations";
import { validateHeroUploadFile, validateUploadFile } from "@/lib/images";
import { MEDIA_IMAGE_EXTENSIONS, sniffImageType } from "@/lib/media";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { rolesForPermission } from "@/lib/rbac";
import { UPLOAD_BUCKETS, UPLOAD_ROOT, UPLOAD_URL_PREFIX, type UploadBucket } from "@/lib/uploads";
import type { ApiResponse } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 20 uploads / minute / user (falls back to IP for guests). */
const limiter = createRateLimiter({ max: 20, windowMs: 60_000 });

/** Customer folders a caller may ask for; anything else lands in `uploads`. */
const CUSTOMER_BUCKETS: Readonly<Record<string, UploadBucket>> = {
  payments: UPLOAD_BUCKETS.payments,
  "mukra/payments": UPLOAD_BUCKETS.payments,
  returns: UPLOAD_BUCKETS.returns,
  "mukra/returns": UPLOAD_BUCKETS.returns,
};

function customerBucket(value: FormDataEntryValue | null): UploadBucket {
  if (typeof value !== "string") return UPLOAD_BUCKETS.uploads;
  return CUSTOMER_BUCKETS[value.trim().toLowerCase().replace(/^\/+|\/+$/g, "")] ?? UPLOAD_BUCKETS.uploads;
}

function failure(error: string, status: number): NextResponse<ApiResponse<unknown>> {
  return NextResponse.json({ data: null, error, success: false }, { status });
}

/* -------------------------------------------------------------------------- */
/*  Local disk fallback                                                        */
/* -------------------------------------------------------------------------- */

async function saveLocally(
  bytes: Buffer,
  bucket: UploadBucket,
  extension: string,
  originalName: string,
): Promise<{ url: string; publicId: string; bytes: number }> {
  const target = path.join(UPLOAD_ROOT, bucket);
  await mkdir(target, { recursive: true });

  const safeName = originalName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 60);
  const fileName = `${Date.now()}-${safeName || "asset"}.${extension}`;
  await writeFile(path.join(target, fileName), bytes);

  return {
    url: `${UPLOAD_URL_PREFIX}/${bucket}/${fileName}`,
    publicId: `local:${bucket}/${fileName}`,
    bytes: bytes.byteLength,
  };
}

/* -------------------------------------------------------------------------- */
/*  POST — multipart upload                                                    */
/* -------------------------------------------------------------------------- */

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const session = await auth();
  const isHeroUpload = request.nextUrl.searchParams.get("purpose") === "hero";
  if (isHeroUpload) {
    /* Hero/banner media is the SEO manager's surface (plus super admins). */
    const gate = await requireActionRole(rolesForPermission("settings:write"));
    if (!gate.ok) return failure(gate.message, gate.reason === "unauthenticated" ? 401 : 403);
  }

  const key = session?.user?.email ?? clientIp(request.headers);
  const limit = limiter.check(key);
  if (!limit.ok) return failure(`Too many uploads — try again in ${limit.retryAfter}s`, 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return failure("Expected multipart/form-data", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return failure("No file provided", 400);

  const validation = (isHeroUpload ? validateHeroUploadFile : validateUploadFile)({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (!validation.ok) return failure(validation.error ?? "That file can't be uploaded", 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  let extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";

  // Customer images must really be images — a renamed PDF/HTML file is refused.
  if (!isHeroUpload) {
    const sniffed = sniffImageType(buffer);
    if (!sniffed || sniffed === "image/avif") {
      return failure("That file isn't a valid JPEG, PNG or WebP image", 400);
    }
    extension = MEDIA_IMAGE_EXTENSIONS[sniffed];
  }

  const bucket = isHeroUpload ? UPLOAD_BUCKETS.hero : customerBucket(form.get("folder"));
  const resourceType = validation.kind === "video" ? "video" : "image";

  // Cloudinary when configured (a failure is reported, not hidden on local
  // disk that may be read-only); local disk otherwise so uploads still work.
  let asset: Record<string, unknown>;
  if (isCloudinaryConfigured()) {
    const remote = await uploadToCloudinary(
      { buffer, mimetype: file.type, originalName: file.name },
      `mukra/${bucket}`,
      resourceType,
    );
    if (!remote) return failure("The upload to Cloudinary failed — try again", 502);
    asset = { ...remote };
  } else {
    try {
      asset = {
        ...(await saveLocally(buffer, bucket, extension, file.name)),
        provider: "local",
        format: extension,
      };
    } catch (error) {
      console.error("[api/upload] local upload failed:", error);
      return failure("Uploads are unavailable right now — please try again later", 503);
    }
  }

  return NextResponse.json(
    {
      data: {
        ...asset,
        kind: validation.kind,
        provider: isCloudinaryConfigured() ? "cloudinary" : "local",
        storage: isCloudinaryConfigured() ? "cloudinary" : ".uploads",
      },
      error: null,
      success: true,
    },
    { status: 201 },
  );
}

/* -------------------------------------------------------------------------- */
/*  DELETE — console images only (?publicId=…[&url=…])                         */
/* -------------------------------------------------------------------------- */

/**
 * Kept for older console builds. It now requires a media role and delegates
 * to the same guarded delete as `DELETE /api/admin/upload` (managed folders
 * only, folder owner only, never an image a saved record still uses).
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const gate = await requireActionRole(rolesForPermission("media:upload"));
  if (!gate.ok) return failure(gate.message, gate.reason === "unauthenticated" ? 401 : 403);

  const publicId = request.nextUrl.searchParams.get("publicId")?.trim();
  if (!publicId) return failure("publicId is required", 400);

  try {
    const removed = await deleteManagedImage(gate.user.role, {
      publicId,
      url: request.nextUrl.searchParams.get("url"),
    });
    return NextResponse.json({
      data: {
        deleted: true,
        result: removed.result,
        provider: publicId.startsWith("local:") ? "local" : "cloudinary",
      },
      error: null,
      success: true,
    });
  } catch (error) {
    if (error instanceof MediaError) return failure(error.message, error.status);
    console.error("[api/upload] delete failed:", error);
    return failure("The image couldn't be deleted — try again", 500);
  }
}
