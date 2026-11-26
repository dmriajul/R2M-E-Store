/**
 * Protected upload endpoint.
 *
 * Every upload requires an active, server-verified session and an explicit,
 * authorized purpose:
 * - **Payment proof** — `?purpose=payment` (or `folder=mukra/payments`),
 *   authenticated user session, stored in `mukra/payments`.
 * - **Return evidence** — `?purpose=return` (or `folder=mukra/returns`),
 *   authenticated user session + verified ownership of a delivered `orderId`,
 *   stored in `mukra/returns`.
 * - **Hero media** — `?purpose=hero`, `settings:write` staff permission only,
 *   stored in `mukra/hero`.
 *
 * Unapproved purposes/folders and unauthenticated requests are rejected; there
 * is no unguarded catch-all upload bucket. Console images (products,
 * categories, banners) go through `POST /api/admin/upload` instead.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import {
  getVerifiedSessionUser,
  requireActionRole,
  requireRole,
} from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { MediaError, deleteManagedImage } from "@/lib/data/media";
import { isCloudinaryConfigured } from "@/lib/integrations";
import { validateHeroUploadFile, validateUploadFile } from "@/lib/images";
import { MEDIA_IMAGE_EXTENSIONS, sniffImageType } from "@/lib/media";
import { requireDatabase } from "@/lib/prisma";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { rolesForPermission } from "@/lib/rbac";
import { UPLOAD_BUCKETS, UPLOAD_ROOT, UPLOAD_URL_PREFIX, type UploadBucket } from "@/lib/uploads";
import type { ApiResponse } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 20 uploads / minute / authenticated user. */
const limiter = createRateLimiter({ max: 20, windowMs: 60_000 });

type UploadPurpose = "hero" | "payment" | "return";

const PURPOSE_ALIASES: Readonly<Record<string, UploadPurpose>> = {
  hero: "hero",
  payment: "payment",
  payments: "payment",
  return: "return",
  returns: "return",
};

const FOLDER_PURPOSES: Readonly<Record<string, UploadPurpose>> = {
  hero: "hero",
  "mukra/hero": "hero",
  payment: "payment",
  payments: "payment",
  "mukra/payments": "payment",
  return: "return",
  returns: "return",
  "mukra/returns": "return",
};

function normalizeToken(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  return cleaned.length > 0 ? cleaned : undefined;
}

type ResolvedUploadTarget =
  | { ok: true; purpose: UploadPurpose; bucket: UploadBucket }
  | { ok: false; status: 400 | 403; error: string };

function resolveUploadTarget(
  queryPurposeRaw: string | null,
  formPurposeRaw: FormDataEntryValue | null,
  formFolderRaw: FormDataEntryValue | null,
): ResolvedUploadTarget {
  const queryToken = queryPurposeRaw === null ? undefined : queryPurposeRaw.trim().toLowerCase();
  const formToken = normalizeToken(formPurposeRaw);
  const folderToken = normalizeToken(formFolderRaw);

  if (queryPurposeRaw !== null && !queryToken) {
    return { ok: false, status: 403, error: "Upload purpose is not permitted" };
  }

  if (queryToken !== undefined && !(queryToken in PURPOSE_ALIASES)) {
    return { ok: false, status: 403, error: "Upload purpose is not permitted" };
  }

  if (formToken !== undefined && !(formToken in PURPOSE_ALIASES)) {
    return { ok: false, status: 403, error: "Upload purpose is not permitted" };
  }

  const fromQuery = queryToken ? PURPOSE_ALIASES[queryToken] : undefined;
  const fromForm = formToken ? PURPOSE_ALIASES[formToken] : undefined;
  if (fromQuery && fromForm && fromQuery !== fromForm) {
    return { ok: false, status: 400, error: "Conflicting upload purpose values" };
  }

  const fromFolder = folderToken ? FOLDER_PURPOSES[folderToken] : undefined;
  if (folderToken !== undefined && !fromFolder) {
    return { ok: false, status: 403, error: "Upload destination is not permitted" };
  }

  const explicitPurpose = fromQuery ?? fromForm;
  if (explicitPurpose && fromFolder && explicitPurpose !== fromFolder) {
    return { ok: false, status: 400, error: "Upload purpose and folder do not match" };
  }

  const purpose = explicitPurpose ?? fromFolder;
  if (!purpose) {
    return { ok: false, status: 400, error: "Upload purpose is required" };
  }

  const bucket =
    purpose === "hero"
      ? UPLOAD_BUCKETS.hero
      : purpose === "payment"
        ? UPLOAD_BUCKETS.payments
        : UPLOAD_BUCKETS.returns;

  return { ok: true, purpose, bucket };
}

function failure(error: string, status: number): NextResponse<ApiResponse<unknown>> {
  return NextResponse.json(
    { data: null, error, success: false },
    { status, headers: { "Cache-Control": "no-store" } },
  );
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
  const rawQueryPurpose = request.nextUrl.searchParams.get("purpose");
  const normalizedQueryPurpose = rawQueryPurpose?.trim().toLowerCase();

  // Require an active, database-verified session before buffering multipart data.
  const verifiedUser = await getVerifiedSessionUser();
  if (!verifiedUser) {
    return failure("Authentication required. Sign in to upload files.", 401);
  }

  // Reject unapproved query-string purposes early before reading request body.
  if (rawQueryPurpose !== null) {
    if (!normalizedQueryPurpose || !(normalizedQueryPurpose in PURPOSE_ALIASES)) {
      return failure("Upload purpose is not permitted", 403);
    }
    if (PURPOSE_ALIASES[normalizedQueryPurpose] === "hero") {
      const heroGate = requireRole(
        { user: verifiedUser },
        rolesForPermission("settings:write"),
      );
      if (!heroGate.ok) {
        return failure(heroGate.message, heroGate.reason === "unauthenticated" ? 401 : 403);
      }
    }
  }

  const key = `user:${verifiedUser.id}:${clientIp(request.headers)}`;
  const limit = limiter.check(key);
  if (!limit.ok) return failure(`Too many uploads — try again in ${limit.retryAfter}s`, 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return failure("Expected multipart/form-data", 400);
  }

  const target = resolveUploadTarget(
    rawQueryPurpose,
    form.get("purpose"),
    form.get("folder"),
  );
  if (!target.ok) {
    return failure(target.error, target.status);
  }

  const isHeroUpload = target.purpose === "hero";
  if (isHeroUpload) {
    /* Hero/banner media is the SEO manager's surface (plus super admins). */
    const gate = requireRole(
      { user: verifiedUser },
      rolesForPermission("settings:write"),
    );
    if (!gate.ok) return failure(gate.message, gate.reason === "unauthenticated" ? 401 : 403);
  }

  if (target.purpose === "return") {
    const formOrderId = form.get("orderId");
    const orderId = (
      typeof formOrderId === "string"
        ? formOrderId
        : (request.nextUrl.searchParams.get("orderId") ?? "")
    ).trim();
    if (!orderId) {
      return failure("Order ID is required for return evidence uploads", 400);
    }

    let order: { id: string; userId: string | null; status: string } | null;
    try {
      order = await requireDatabase(async (db) =>
        (await db.order.findFirst({
          where: { id: orderId },
          select: { id: true, userId: true, status: true },
        })) as { id: string; userId: string | null; status: string } | null,
      );
    } catch {
      return failure("Order verification is temporarily unavailable", 503);
    }

    if (!order || order.userId !== verifiedUser.id) {
      return failure("You do not have permission to upload return evidence for this order", 403);
    }
    if (order.status !== "DELIVERED") {
      return failure("Return evidence can only be uploaded for delivered orders", 403);
    }
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

  const bucket = target.bucket;
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
