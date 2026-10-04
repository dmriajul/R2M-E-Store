import { NextResponse, type NextRequest } from "next/server";
import { MOCK_PRODUCTS } from "@/lib/site";
import type { ApiResponse, Product } from "@/types";

/**
 * Temporary catalogue endpoint backed by mock data. Supports `?category=` and
 * `?featured=true`; replace the body with a database query in a later step.
 */
export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");

  let products: readonly Product[] = MOCK_PRODUCTS;

  if (category) {
    products = products.filter((product) => product.category === category);
  }

  if (featured === "true") {
    products = products.filter((product) => product.featured);
  }

  const payload: ApiResponse<Product[]> = {
    data: [...products],
    error: null,
    success: true,
  };

  return NextResponse.json(payload, { status: 200 });
}
