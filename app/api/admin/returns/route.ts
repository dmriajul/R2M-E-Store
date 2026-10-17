import { NextResponse, type NextRequest } from "next/server";
import { requireActionRole } from "@/lib/auth";
import { rolesForPermission } from "@/lib/rbac";
import { getAdminReturnsPage } from "@/lib/data/admin-returns";
import { returnsQuerySchema, RETURNS_LOAD_ERROR } from "@/lib/admin-returns";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, must-revalidate" };

export async function GET(request: NextRequest) {
  const gate = await requireActionRole(rolesForPermission("returns:read"));
  if (!gate.ok) return NextResponse.json({ data: null, error: gate.message, success: false }, { status: gate.reason === "unauthenticated" ? 401 : 403, headers });

  const parsed = returnsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? "Invalid return filters", success: false }, { status: 400, headers });
  try {
    const db = await getPrisma();
    if (!db) return NextResponse.json({ data: null, error: "Return management requires a configured database", success: false }, { status: 503, headers });
    // Preserve the sidebar count API's existing response contract.
    if (request.nextUrl.searchParams.get("countOnly") === "true") {
      const count = await db.returnRequest.count({ where: { status: "PENDING" } });
      return NextResponse.json({ data: count, error: null, success: true, source: "database" }, { headers });
    }
    return NextResponse.json({ ...await getAdminReturnsPage(db, parsed.data), source: "database" }, { headers });
  } catch (error) {
    console.error("[admin/returns] Read failed", error);
    return NextResponse.json({ data: null, error: RETURNS_LOAD_ERROR, success: false }, { status: 503, headers });
  }
}
