import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  getAdminProducts,
  parseAdminProduct,
  saveAdminProduct,
} from "@/lib/data/admin-products";
import type { AdminProduct, ApiResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorized() {
  const session = await auth();
  return session?.user?.role === "ADMIN";
}

export async function GET(): Promise<NextResponse<ApiResponse<AdminProduct[]>>> {
  if (!(await authorized())) {
    return NextResponse.json(
      { data: null, error: "Administrator access required", success: false },
      { status: 403 },
    );
  }

  try {
    const products = await getAdminProducts();
    return NextResponse.json({
      data: products,
      error: null,
      success: true,
      source: products ? "database" : "mock",
    });
  } catch (error) {
    console.error("[admin/products] Failed to load products", error);
    return NextResponse.json(
      { data: null, error: "Could not load products", success: false },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ product: AdminProduct | null }>>> {
  if (!(await authorized())) {
    return NextResponse.json(
      { data: null, error: "Administrator access required", success: false },
      { status: 403 },
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Expected a JSON product payload", success: false },
      { status: 400 },
    );
  }

  const parsed = parseAdminProduct(input);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid product data", success: false },
      { status: 400 },
    );
  }

  try {
    const product = await saveAdminProduct(parsed.data);
    if (product) {
      revalidateProductPaths(product.slug);
    }
    return NextResponse.json(
      {
        data: { product },
        error: null,
        success: true,
        source: product ? "database" : "mock",
      },
      { status: 201 },
    );
  } catch (error) {
    const uniqueConflict =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002";
    console.error("[admin/products] Failed to create product", error);
    return NextResponse.json(
      {
        data: null,
        error: uniqueConflict
          ? "A product with this SKU or slug already exists"
          : "Could not save product",
        success: false,
      },
      { status: uniqueConflict ? 409 : 500 },
    );
  }
}

function revalidateProductPaths(slug: string) {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/api/products");
  revalidatePath("/sitemap.xml");
  revalidatePath("/product/[id]", "page");
  revalidatePath(`/product/${encodeURIComponent(slug)}`);
}
