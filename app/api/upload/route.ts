import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { MODEL_FOLDER, PRODUCT_FOLDER, deleteFromCloudinary, uploadToCloudinary } from "@/lib/cloudinary";
import { isCloudinaryConfigured } from "@/lib/demo-mode";
import { validateUploadFile } from "@/lib/images";
import { UPLOAD_BUCKETS, UPLOAD_URL_PREFIX, UPLOAD_ROOT } from "@/lib/uploads";
import type { ApiResponse } from "@/types";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  Rate limiting — 20 uploads / minute / user (falls back to IP)              */
/* -------------------------------------------------------------------------- */

const WINDOW_MS = 60_000;
const MAX_UPLOADS = 20;
const hits = new Map<string, number[]>();

function rateLimit(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);

  if (recent.length >= MAX_UPLOADS) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - recent[0]!)) / 1000) };
  }

  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfter: 0 };
}

/* -------------------------------------------------------------------------- */
/*  Local disk fallback                                                        */
/* -------------------------------------------------------------------------- */

async function saveLocally(
  file: File,
  folder: string,
): Promise<{ url: string; publicId: string; bytes: number }> {
  const bucket = folder === MODEL_FOLDER ? UPLOAD_BUCKETS.models : UPLOAD_BUCKETS.products;
  const target = path.join(UPLOAD_ROOT, bucket);
  await mkdir(target, { recursive: true });

  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 60);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const fileName = `${Date.now()}-${safeName || "asset"}.${extension}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(target, fileName), buffer);

  return {
    url: `${UPLOAD_URL_PREFIX}/${bucket}/${fileName}`,
    publicId: `local:${bucket}/${fileName}`,
    bytes: buffer.byteLength,
  };
}

/* -------------------------------------------------------------------------- */
/*  POST — multipart upload                                                    */
/* -------------------------------------------------------------------------- */

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const session = await auth();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = session?.user?.email ?? forwarded ?? "anonymous";

  const limit = rateLimit(key);
  if (!limit.ok) {
    return NextResponse.json(
      { data: null, error: `Too many uploads — try again in ${limit.retryAfter}s`, success: false },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { data: null, error: "Expected multipart/form-data", success: false },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const folder = String(form.get("folder") ?? PRODUCT_FOLDER);
  const kind = folder === MODEL_FOLDER || String(form.get("kind") ?? "") === "model" ? "model" : "image";

  if (!(file instanceof File)) {
    return NextResponse.json({ data: null, error: "No file provided", success: false }, { status: 400 });
  }

  const validation = validateUploadFile(
    { name: file.name, type: file.type, size: file.size },
    kind,
  );
  if (!validation.ok) {
    return NextResponse.json(
      { data: null, error: validation.error ?? "That file can't be uploaded", success: false },
      { status: 400 },
    );
  }

  // Prefer Cloudinary; fall back to the local disk so the demo always works.
  const remote = await uploadToCloudinary(
    { buffer: Buffer.from(await file.arrayBuffer()), mimetype: file.type, originalName: file.name },
    folder,
  );

  const asset =
    remote ??
    ({
      ...(await saveLocally(file, folder)),
      provider: "local" as const,
      format: file.name.split(".").pop(),
    });

  return NextResponse.json(
    {
      data: {
        ...asset,
        kind: validation.kind,
        provider: remote ? "cloudinary" : "local",
        storage: isCloudinaryConfigured() ? "cloudinary" : ".uploads",
      },
      error: null,
      success: true,
    },
    { status: 201 },
  );
}

/* -------------------------------------------------------------------------- */
/*  DELETE — remove an asset (?publicId=…&folder=…)                            */
/* -------------------------------------------------------------------------- */

export async function DELETE(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const publicId = request.nextUrl.searchParams.get("publicId");
  const folder = request.nextUrl.searchParams.get("folder") ?? PRODUCT_FOLDER;

  if (!publicId) {
    return NextResponse.json({ data: null, error: "publicId is required", success: false }, { status: 400 });
  }

  if (publicId.startsWith("local:")) {
    const relative = publicId.replace("local:", "");
    try {
      await unlink(path.join(UPLOAD_ROOT, relative));
    } catch {
      /* already gone — treat as success */
    }
    return NextResponse.json({ data: { deleted: true, provider: "local" }, error: null, success: true });
  }

  const deleted = await deleteFromCloudinary(publicId, folder);
  return NextResponse.json(
    {
      data: { deleted, provider: "cloudinary" },
      error: deleted ? null : "Cloudinary is not configured — nothing was deleted",
      success: deleted,
    },
    { status: deleted ? 200 : 400 },
  );
}
