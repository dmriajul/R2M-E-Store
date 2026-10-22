import { NextResponse } from "next/server";
import { requireActionRole } from "@/lib/auth";
import { rolesForPermission } from "@/lib/rbac";
import { getAdminOrders } from "@/lib/data/admin-orders";
import { describeAdminError } from "@/lib/data/admin-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, must-revalidate" };

/** Same unfiltered, newest-first Postgres records used by checkout/admin actions. */
export async function GET() {
  const gate = await requireActionRole(rolesForPermission("orders:read"));
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.reason === "unauthenticated" ? 401 : 403, headers });
  try {
    const orders = await getAdminOrders();
    return NextResponse.json({ data: orders, source: "database", error: null }, { headers });
  } catch (error) {
    return NextResponse.json({ data: null, error: describeAdminError(error, "Could not load live orders. Please retry.") }, { status: 503, headers });
  }
}
