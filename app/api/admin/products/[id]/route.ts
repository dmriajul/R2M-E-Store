import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireActionRole } from "@/lib/auth";
import { rolesForPermission } from "@/lib/rbac";
import {
  parseAdminProduct,
  saveAdminProduct,
} from "@/lib/data/admin-products";
import type { AdminProduct, ApiResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<ApiResponse<{ product: AdminProduct | null }>>> {
  const gate = await requireActionRole(rolesForPermission("products:write"));
  if (!gate.ok) {
    return NextResponse.json(
      { data: null, error: "Administrator access required", success: false },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!id.trim()) {
    return NextResponse.json(
      { data: null, error: "Product ID is required", success: false },
      { status: 400 },
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
    const product = await saveAdminProduct(parsed.data, id);
    if (!product) {
      return NextResponse.json({
        data: { product: null },
        error: null,
        success: true,
        source: "mock",
      });
    }

    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath("/api/products");
    revalidatePath("/sitemap.xml");
    revalidatePath("/product/[id]", "page");
    revalidatePath(`/product/${encodeURIComponent(product.slug)}`);

    return NextResponse.json({
      data: { product },
      error: null,
      success: true,
      source: "database",
    });
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    console.error("[admin/products] Failed to update product", error);
    return NextResponse.json(
      {
        data: null,
        error:
          errorCode === "P2025"
            ? "Product not found"
            : errorCode === "P2002"
              ? "A product with this SKU or slug already exists"
              : "Could not save product",
        success: false,
      },
      { status: errorCode === "P2025" ? 404 : errorCode === "P2002" ? 409 : 500 },
    );
  }
}
