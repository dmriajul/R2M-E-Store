import assert from "node:assert/strict";
import { test } from "node:test";
import { returnsQuerySchema, buildReturnsWhere, isUrgentReturn, returnReference, returnsToCsv, statusAfterAction } from "../lib/admin-returns";
import { getAdminReturnsPage } from "../lib/data/admin-returns";
import type { PrismaLikeClient } from "../lib/prisma";
import type { ReturnRequestRecord } from "../types";

const record: ReturnRequestRecord = { id: "RET-2026-001", orderId: "order-1", orderNumber: "LL-2026-12345", userId: "user-1", customerName: "Test Customer", customerEmail: "test@example.com", customerPhone: "01700000000", orderItemId: "line-1", itemName: "Winter jacket", itemSize: "M", itemColor: "Gold", quantity: 1, type: "REFUND", reason: "Too small", images: [], status: "PENDING", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" };

test("query defaults to 20 records and all statuses", () => {
  const result = returnsQuerySchema.parse({});
  assert.equal(result.pageSize, 20);
  assert.deepEqual(result.status, []);
  assert.deepEqual(buildReturnsWhere(result), {});
});
test("multi-select includes Received and applies request type/date/search on server", () => {
  const result = returnsQuerySchema.parse({ status: "PENDING,RECEIVED", type: "EXCHANGE", from: "2026-10-01", to: "2026-10-16", q: "Sarah" });
  const where = buildReturnsWhere(result);
  assert.deepEqual(where.status, { in: ["PENDING", "RECEIVED"] });
  assert.equal(where.type, "EXCHANGE");
  assert.deepEqual(where.createdAt, { gte: new Date("2026-10-01T00:00:00.000Z"), lte: new Date("2026-10-16T23:59:59.999Z") });
  assert.equal((where.OR as unknown[]).length, 5);
});
test("invalid status/type/date/pagination values are rejected", () => {
  for (const value of [{ status: "DRAFT" }, { type: "HACK" }, { pageSize: 0 }, { pageSize: 101 }, { pageSize: "x" }, { from: "2026-02-30" }, { from: "2026-10-16", to: "2026-10-01" }, { q: "a".repeat(151) }, { cursor: "" }]) assert.equal(returnsQuerySchema.safeParse(value).success, false, JSON.stringify(value));
});
test("search covers real request ID and order/customer relations", () => {
  const where = buildReturnsWhere(returnsQuerySchema.parse({ q: "#RET-cuid-123" }));
  const conditions = where.OR as Record<string, unknown>[];
  assert.deepEqual(conditions[1], { id: { contains: "cuid-123", mode: "insensitive" } });
  assert.ok(conditions.some((c) => "order" in c));
  assert.ok(conditions.some((c) => "user" in c));
});
test("urgent only means pending for strictly more than three days", () => {
  const created = Date.parse(record.createdAt);
  assert.equal(isUrgentReturn(record, created + 3 * 86400000), false);
  assert.equal(isUrgentReturn(record, created + 3 * 86400000 + 1), true);
  assert.equal(isUrgentReturn({ ...record, status: "APPROVED" }, created + 5 * 86400000), false);
  assert.equal(isUrgentReturn(record, created - 100), false);
});
test("display references use the full request ID, not the order number", () => {
  assert.equal(returnReference(record.id), "#RET-2026-001");
  assert.equal(returnReference("cmabcdefghij"), "#RET-cmabcdefghij");
});
test("optimistic action status mapping preserves all workflow outcomes", () => {
  assert.equal(statusAfterAction("approve"), "APPROVED");
  assert.equal(statusAfterAction("reject"), "REJECTED");
  assert.equal(statusAfterAction("complete"), "COMPLETED");
});
test("CSV quotes cells and neutralizes spreadsheet formulas", () => {
  const csv = returnsToCsv([{ ...record, customerName: '=HYPERLINK("bad")', reason: 'Wrong, "size"\nPlease help' }]);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"Wrong, ""size""\nPlease help"'));
  assert.ok(csv.includes('"RET-2026-001"'));
});

function mockDb(rows: number, inspect: (args: unknown) => void = () => {}) {
  const returnRows = Array.from({ length: rows }, (_, i) => ({
    ...record, id: `RET-${i}`, order: { orderNumber: record.orderNumber }, user: { name: record.customerName, email: record.customerEmail }, orderItem: { name: record.itemName, size: "M", color: "Gold", quantity: 1 },
  }));
  return { returnRequest: { findMany: async (args: unknown) => { inspect(args); return returnRows; }, count: async () => 55 } } as unknown as PrismaLikeClient;
}
test("server fetch is bounded to 20+1 and newest first, returning a cursor", async () => {
  const result = await getAdminReturnsPage(mockDb(21, (args) => {
    const query = args as { take: number; orderBy: unknown; cursor?: unknown };
    assert.equal(query.take, 21);
    assert.deepEqual(query.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
    assert.equal(query.cursor, undefined);
  }), returnsQuerySchema.parse({}));
  assert.equal(result.data.length, 20);
  assert.equal(result.pagination.nextCursor, "RET-19");
  assert.equal(result.pagination.total, 55);
  assert.equal(result.summary.pending, 55);
});
test("load more uses cursor/skip instead of fetching the full database", async () => {
  const result = await getAdminReturnsPage(mockDb(5, (args) => {
    assert.deepEqual((args as { cursor: unknown }).cursor, { id: "RET-19" });
    assert.equal((args as { skip: number }).skip, 1);
  }), returnsQuerySchema.parse({ cursor: "RET-19" }));
  assert.equal(result.pagination.nextCursor, null);
  assert.equal(result.data.length, 5);
});
test("empty database is a successful empty page, not an API error", async () => {
  const result = await getAdminReturnsPage(mockDb(0), returnsQuerySchema.parse({}));
  assert.deepEqual(result.data, []);
  assert.equal(result.pagination.nextCursor, null);
  assert.equal(result.success, true);
});
test("database failure propagates to the route's explicit error response", async () => {
  const db = mockDb(0);
  db.returnRequest.findMany = async () => { throw new Error("database down"); };
  await assert.rejects(getAdminReturnsPage(db, returnsQuerySchema.parse({})), /database down/);
});
