import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireActionRole } from "@/lib/auth";
import { rolesForPermission, type AdminPermission } from "@/lib/rbac";
import {
  getAdminProducts,
  parseAdminProduct,
  saveAdminProduct,
} from "@/lib/data/admin-products";
import type { AdminProduct, ApiResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Role check against the RBAC matrix. `products:write` covers the inventory
 * team and super admins; `products:read` additionally covers the SEO manager.
 * The failure carries the right status: 401 without a session, 403 with one
 * whose role is too low.
 */
async function authorized(
  permission: AdminPermission,
): Promise<{ ok: true } | { ok: false; status: 401 | 403 }> {
  const gate = await requireActionRole(rolesForPermission(permission));
  if (gate.ok) return { ok: true };
  return { ok: false, status: gate.reason === "unauthenticated" ? 401 : 403 };
}

/** Shared denial body. */
function denied(status: 401 | 403) {
  return NextResponse.json(
    {
      data: null,
      error:
        status === 401 ? "Administrator access required" : "Your role can't access this resource",
      success: false,
    },
    { status },
  );
}

export async function GET(): Promise<NextResponse<ApiResponse<AdminProduct[]>>> {
  const read = await authorized("products:read");
  if (!read.ok) return denied(read.status);

  try {
    const products = await getAdminProducts();
    return NextResponse.json({
      data: products,
      error: null,
      success: true,
      source: "database",
    });
  } catch (error) {
    console.error("[admin/products] Failed to load products", error);
    return NextResponse.json(
      { data: null, error: "Could not load products", success: false },
      { status: error instanceof Error && error.name === "DatabaseUnavailableError" ? 503 : 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ product: AdminProduct | null }>>> {
  const write = await authorized("products:write");
  if (!write.ok) return denied(write.status);

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
    revalidateProductPaths(product.slug);
    return NextResponse.json(
      {
        data: { product },
        error: null,
        success: true,
        source: "database",
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
      {
        status: uniqueConflict
          ? 409
          : error instanceof Error && error.name === "DatabaseUnavailableError"
            ? 503
            : 500,
      },
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
