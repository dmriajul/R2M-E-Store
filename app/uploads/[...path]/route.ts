import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { MIME_BY_EXTENSION, UPLOAD_ROOT } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

/**
 * Serves uploads written by the local fallback in `/api/upload`.
 *
 * Cloudinary is preferred, but demo installs store files on disk — and Next
 * only serves `public/` files that existed at build time, so a runtime-written
 * file would 404 there. This route streams them instead with an explicit
 * content type, path-traversal guard and long-lived caching.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { path: segments } = await context.params;

  // Only flat, safe file names inside the known buckets.
  const safe = segments.every((segment) => /^[A-Za-z0-9._-]+$/.test(segment) && segment !== "..");
  if (!safe || segments.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(UPLOAD_ROOT, ...segments);
  if (!filePath.startsWith(UPLOAD_ROOT)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const extension = (segments.at(-1)?.split(".").pop() ?? "").toLowerCase();
  const contentType = MIME_BY_EXTENSION[extension];
  if (!contentType) {
    return new NextResponse("Unsupported file type", { status: 415 });
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new NextResponse("Not found", { status: 404 });

    const file = await readFile(filePath);

    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
