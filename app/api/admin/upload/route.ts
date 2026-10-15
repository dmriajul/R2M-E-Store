/**
 * Console image uploads.
 *
 * `POST /api/admin/upload` — multipart body with `file` (the image) and
 * `folder` (`products` | `categories` | `banners`; `?folder=` works too).
 * The image is validated (JPEG/PNG/WebP/AVIF by MIME type *and* magic bytes,
 * 5 MB max), stored in Cloudinary under `mukra/<folder>/` with the original
 * capped at 1920px, and answered with **201**:
 *
 * ```json
 * { "url": "https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,w_1920,c_limit/v…/mukra/products/<id>.jpg",
 *   "publicId": "mukra/products/<id>", "width": 1600, "height": 2000, "format": "jpg", "size": 482113 }
 * ```
 *
 * `DELETE /api/admin/upload?publicId=mukra/products/<id>[&url=…]` (or a JSON
 * body `{ publicId, url }`) removes an image — only from the managed folders,
 * only for the folder's owner, and never while a saved record still uses it.
 *
 * Access: SUPER_ADMIN, INVENTORY_MANAGER and SEO_MANAGER (`media:upload`),
 * narrowed per folder — products/categories need `products:write` /
 * `categories:write`, banners need `settings:write`. No session → 401, any
 * other role (customers included) → 403. Errors are `{ "error": string }`.
 *
 * Without Cloudinary credentials (demo mode) files go to `.uploads/<folder>/`
 * and come back as `/uploads/…` URLs with a `local:` public id.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireActionRole } from "@/lib/auth";
import {
  MediaError,
  assertFolderPermission,
  deleteManagedImage,
  storeAdminImage,
  type RemoveResult,
} from "@/lib/data/media";
import { MEDIA_MAX_BYTES, parseMediaFolder } from "@/lib/media";
import { createRateLimiter } from "@/lib/rate-limit";
import { rolesForPermission } from "@/lib/rbac";
import type { AdminUploadErrorBody, AdminUploadResult, AdminUser } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Cloudinary uploads of a few MB can take several seconds. */
export const maxDuration = 60;

/** Per-operator limits (each server instance keeps its own window). */
const uploadLimiter = createRateLimiter({ max: 30, windowMs: 60_000 });
const deleteLimiter = createRateLimiter({ max: 60, windowMs: 60_000 });

/** The file limit plus generous room for multipart boundaries and fields. */
const MAX_REQUEST_BYTES = MEDIA_MAX_BYTES + 256 * 1024;

const NO_STORE = { "Cache-Control": "no-store" } as const;

function errorResponse(
  error: string,
  status: number,
  headers: Record<string, string> = {},
): NextResponse<AdminUploadErrorBody> {
  return NextResponse.json({ error }, { status, headers: { ...NO_STORE, ...headers } });
}

/**
 * Defence in depth on top of the SameSite=Lax session cookie: browsers always
 * send `Origin` on cross-origin POST/DELETE, so one that doesn't match the
 * host the request was addressed to is refused — the same rule Next.js
 * applies to Server Actions. Non-browser clients (no `Origin`) still need a
 * valid staff session.
 */
function isCrossOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/** Staff gate shared by both methods: 401 without a session, 403 for other roles. */
async function requireMediaRole(
  request: NextRequest,
): Promise<{ ok: true; user: AdminUser } | { ok: false; response: NextResponse<AdminUploadErrorBody> }> {
  if (isCrossOrigin(request)) {
    return { ok: false, response: errorResponse("Cross-origin requests are not allowed.", 403) };
  }

  const gate = await requireActionRole(rolesForPermission("media:upload"));
  if (!gate.ok) {
    return {
      ok: false,
      response: errorResponse(gate.message, gate.reason === "unauthenticated" ? 401 : 403),
    };
  }
  return { ok: true, user: gate.user };
}

function mediaErrorResponse(error: unknown, action: "upload" | "delete"): NextResponse<AdminUploadErrorBody> {
  if (error instanceof MediaError) return errorResponse(error.message, error.status);

  console.error(`[api/admin/upload] unexpected ${action} failure:`, error);
  return errorResponse(
    action === "upload" ? "The upload failed unexpectedly — try again." : "The image couldn't be deleted — try again.",
    500,
  );
}

/* -------------------------------------------------------------------------- */
/*  POST — upload one image                                                    */
/* -------------------------------------------------------------------------- */

export async function POST(
  request: NextRequest,
): Promise<NextResponse<AdminUploadResult | AdminUploadErrorBody>> {
  const gate = await requireMediaRole(request);
  if (!gate.ok) return gate.response;

  const limit = uploadLimiter.check(gate.user.id);
  if (!limit.ok) {
    return errorResponse(`Too many uploads — try again in ${limit.retryAfter}s.`, 429, {
      "Retry-After": String(limit.retryAfter),
    });
  }

  // Refuse oversized bodies before buffering them.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    return errorResponse("Images must be 5 MB or smaller.", 413);
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
    return errorResponse("Send the image as multipart/form-data with a `file` field.", 400);
  }

  // A `?folder=` hint lets us refuse the wrong folder before reading the body.
  const queryFolder = request.nextUrl.searchParams.get("folder");
  try {
    if (queryFolder) {
      const folder = parseMediaFolder(queryFolder);
      if (folder) assertFolderPermission(gate.user.role, folder);
    }
  } catch (error) {
    return mediaErrorResponse(error, "upload");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Send the image as multipart/form-data with a `file` field.", 400);
  }

  const folderField = form.get("folder");
  const folder = parseMediaFolder(queryFolder ?? (typeof folderField === "string" ? folderField : null));
  if (!folder) {
    return errorResponse("Choose a destination folder: products, categories or banners.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return errorResponse("No file provided — attach the image as the `file` field.", 400);
  }

  try {
    assertFolderPermission(gate.user.role, folder);
    const asset = await storeAdminImage(file, folder);
    return NextResponse.json(asset, { status: 201, headers: NO_STORE });
  } catch (error) {
    return mediaErrorResponse(error, "upload");
  }
}

/* -------------------------------------------------------------------------- */
/*  DELETE — remove an image by public id                                      */
/* -------------------------------------------------------------------------- */

/** `publicId`/`url` from the query string, or from a JSON body. */
async function readDeleteTarget(
  request: NextRequest,
): Promise<{ publicId: string | null; url: string | null }> {
  const params = request.nextUrl.searchParams;
  let publicId = params.get("publicId");
  let url = params.get("url");

  if (!publicId && request.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = (await request.json()) as { publicId?: unknown; url?: unknown } | null;
      publicId = typeof body?.publicId === "string" ? body.publicId : null;
      url = typeof body?.url === "string" ? body.url : url;
    } catch {
      /* fall through to the missing-id error */
    }
  }

  return { publicId: publicId?.trim() || null, url: url?.trim() || null };
}

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse<RemoveResult | AdminUploadErrorBody>> {
  const gate = await requireMediaRole(request);
  if (!gate.ok) return gate.response;

  const limit = deleteLimiter.check(gate.user.id);
  if (!limit.ok) {
    return errorResponse(`Too many deletes — try again in ${limit.retryAfter}s.`, 429, {
      "Retry-After": String(limit.retryAfter),
    });
  }

  const target = await readDeleteTarget(request);
  if (!target.publicId) {
    return errorResponse("publicId is required.", 400);
  }

  try {
    const result = await deleteManagedImage(gate.user.role, {
      publicId: target.publicId,
      url: target.url,
    });
    return NextResponse.json(result, { status: 200, headers: NO_STORE });
  } catch (error) {
    return mediaErrorResponse(error, "delete");
  }
}
