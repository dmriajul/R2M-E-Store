import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { returnRequestInclude, hydrateReturnRequest } from "@/lib/data/returns";
import { getPrisma } from "@/lib/prisma";
import type { ApiResponse, ReturnRequestRecord, ReturnStatusKey } from "@/types";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<ReturnRequestRecord[] | number>>> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ data: null, error: "Admin access required", success: false }, { status: session?.user ? 403 : 401 });
  }
  const db = await getPrisma();
  if (!db) {
    // Demo mode: customers can only file returns when a database is configured
    // (see /api/returns), so there are genuinely none to report. Answering with
    // an empty result keeps the admin badge and Returns page quiet instead of
    // surfacing a 503 on every admin screen.
    const empty = request.nextUrl.searchParams.get("countOnly") === "true" ? 0 : [];
    return NextResponse.json({ data: empty, error: null, success: true, source: "mock" });
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
