import { NextResponse, type NextRequest } from "next/server";
import { listProducts } from "@/lib/data/products";
import type { ApiResponse, Product } from "@/types";

export const runtime = "nodejs";

const placements = ["virtualBoutique", "newArrival", "bestSeller"] as const;

/**
 * Catalogue endpoint.
 *
 * Reads the Postgres catalogue — there is no baked-in fallback. Public requests
 * always exclude drafts; when the database is unreachable the route answers
 * 503 so callers can tell "no products" apart from "catalogue unavailable".
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

  try {
    const { products, source } = await listProducts({
      category: searchParams.get("category") ?? undefined,
      featured: searchParams.get("featured") === "true",
      placement,
    });

    return NextResponse.json(
      { data: products, error: null, success: true, source },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "DatabaseUnavailableError") {
      return NextResponse.json(
        {
          data: null,
          error: "The catalogue is temporarily unavailable. Please try again shortly.",
          success: false,
        },
        { status: 503 },
      );
    }
    console.error("[api/products] Failed to load products", error);
    return NextResponse.json(
      { data: null, error: "Could not load products", success: false },
      { status: 500 },
    );
  }
}
