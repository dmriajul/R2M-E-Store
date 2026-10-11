import { NextResponse, type NextRequest } from "next/server";
import { listProducts } from "@/lib/data/products";
import type { ApiResponse, Product } from "@/types";

export const runtime = "nodejs";

const placements = ["virtualBoutique", "newArrival", "bestSeller"] as const;

/**
 * Catalogue endpoint.
 *
 * Reads the seeded Postgres catalogue when `DATABASE_URL` is set and the mock
 * catalogue in `lib/site.ts` otherwise — `source` in the response says which
 * one answered. Public requests always exclude drafts.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<Product[]>>> {
  const { searchParams } = request.nextUrl;
  const requestedPlacement = searchParams.get("placement");
  const placement = placements.find((item) => item === requestedPlacement);
  if (requestedPlacement && !placement) {
    return NextResponse.json(
      { data: null, error: "Invalid product placement", success: false },
      { status: 400 },
    );
  }

  const { products, source } = await listProducts({
    category: searchParams.get("category") ?? undefined,
    featured: searchParams.get("featured") === "true",
    placement,
  });

  return NextResponse.json(
    { data: products, error: null, success: true, source },
    { status: 200 },
  );
}
