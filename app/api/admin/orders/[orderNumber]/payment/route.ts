import { NextResponse, type NextRequest } from "next/server";
import { requireActionRole } from "@/lib/auth";
import { rolesForPermission } from "@/lib/rbac";
import { markCashCollected, resolveManualPayment } from "@/lib/data/orders";
import { paymentsAdminSchema } from "@/lib/validations";
import type { ApiResponse, OrderRecord } from "@/types";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ orderNumber: string }>;
}

/**
 * Admin decision on a manual (bKash / Nagad / Rocket) payment.
 *
 * `approve` → CONFIRMED + PAID, `reject` → CANCELLED + FAILED, `collect-cash`
 * (COD) → DELIVERED + PAID. Requires the ADMIN role; without a database the console
 * applies the same change to its local order list.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<ApiResponse<OrderRecord | { updated: boolean }>>> {
  const gate = await requireActionRole(rolesForPermission("orders:write"));
  if (!gate.ok) {
    return NextResponse.json(
      { data: null, error: gate.message, success: false },
      { status: gate.reason === "unauthenticated" ? 401 : 403 },
    );
  }

  const { orderNumber } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Expected a JSON body", success: false },
      { status: 400 },
    );
  }

  const parsed = paymentsAdminSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid action", success: false },
      { status: 422 },
    );
  }

  if (parsed.data.action === "collect-cash") {
    const updated = await markCashCollected(orderNumber);
    return NextResponse.json(
      {
        data: { updated },
        error: updated ? null : "Order not found in the database",
        success: updated,
        source: "mock",
      },
      { status: updated ? 200 : 404 },
    );
  }

  const { order, source } = await resolveManualPayment(orderNumber, parsed.data.action);

  if (!order) {
    return NextResponse.json(
      {
        data: null,
        error: "Order not found in the database",
        success: false,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: order, error: null, success: true, source });
}
