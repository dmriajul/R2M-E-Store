import { buildReturnsWhere, type ReturnsPage, type ReturnsQuery } from "@/lib/admin-returns";
import { returnRequestInclude, hydrateReturnRequest } from "@/lib/data/returns";
import type { PrismaLikeClient } from "@/lib/prisma";

export async function getAdminReturnsPage(db: PrismaLikeClient, query: ReturnsQuery): Promise<ReturnsPage> {
  const where = buildReturnsWhere(query);
  const [rows, total, all, pending, urgent] = await Promise.all([
    db.returnRequest.findMany({
      where, include: returnRequestInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.pageSize + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
    db.returnRequest.count({ where }),
    db.returnRequest.count(),
    db.returnRequest.count({ where: { status: "PENDING" } }),
    db.returnRequest.count({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 3 * 86_400_000) } } }),
  ]);
  const page = rows.slice(0, query.pageSize).map((r) => hydrateReturnRequest(r as Record<string, unknown>));
  return {
    data: page,
    pagination: { total, pageSize: query.pageSize, nextCursor: rows.length > query.pageSize ? page.at(-1)?.id ?? null : null },
    summary: { total: all, pending, urgent },
    success: true, error: null,
  };
}
