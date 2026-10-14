import { NextResponse, type NextRequest } from "next/server";
import { requireActionRole } from "@/lib/auth";
import { rolesForPermission } from "@/lib/rbac";
import { returnRequestInclude, hydrateReturnRequest } from "@/lib/data/returns";
import { getPrisma } from "@/lib/prisma";
import type { ApiResponse, ReturnRequestRecord, ReturnStatusKey } from "@/types";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<ReturnRequestRecord[] | number>>> {
  const gate = await requireActionRole(rolesForPermission("returns:read"));
  if (!gate.ok) {
    return NextResponse.json(
      { data: null, error: gate.message, success: false },
      { status: gate.reason === "unauthenticated" ? 401 : 403 },
    );
  }
  const db = await getPrisma();
  if (!db) {
    return NextResponse.json({ data: null, error: "Return management requires a configured database", success: false }, { status: 503 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const statuses: ReturnStatusKey[] = ["PENDING", "APPROVED", "REJECTED", "RECEIVED", "COMPLETED"];
  const where = status && statuses.includes(status as ReturnStatusKey) ? { status } : {};
  if (request.nextUrl.searchParams.get("countOnly") === "true") {
    const count = await db.returnRequest.count({ where: { status: "PENDING" } });
    return NextResponse.json({ data: count, error: null, success: true, source: "database" });
  }

  const rows = (await db.returnRequest.findMany({
    where,
    include: returnRequestInclude,
    orderBy: { createdAt: "desc" },
  })) as unknown as Record<string, unknown>[];
  return NextResponse.json({
    data: rows.map(hydrateReturnRequest),
    error: null,
    success: true,
    source: "database",
  });
}
