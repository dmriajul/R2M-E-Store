import { NextResponse, type NextRequest } from "next/server";
import { listProducts } from "@/lib/data/products";
import type { ApiResponse, Product } from "@/types";

export const runtime = "nodejs";

/**
 * Catalogue endpoint.
 *
 * Reads the seeded Postgres catalogue when `DATABASE_URL` is set and the mock
 * catalogue in `lib/site.ts` otherwise — `source` in the response says which
 * one answered. Supports `?category=`, `?featured=true` and `?all=true`
 * (include drafts).
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<Product[]>>> {
  const { searchParams } = request.nextUrl;

  const { products, source } = await listProducts({
    category: searchParams.get("category") ?? undefined,
    featured: searchParams.get("featured") === "true",
    activeOnly: searchParams.get("all") !== "true",
  });

  return NextResponse.json(
    { data: products, error: null, success: true, source },
    { status: 200 },
  );
}
