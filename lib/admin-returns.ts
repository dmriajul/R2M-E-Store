import { z } from "zod";
import type { ReturnRequestRecord, ReturnStatusKey } from "@/types";

export const RETURN_STATUSES = ["PENDING", "APPROVED", "REJECTED", "RECEIVED", "COMPLETED"] as const;
export const RETURN_PAGE_SIZE = 20;
export const RETURNS_AUTO_REFRESH_KEY = "mukra:returns:auto-refresh";
export const RETURNS_LOAD_ERROR = "Failed to load returns. Try again.";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Invalid calendar date");
export const returnsQuerySchema = z.object({
  q: z.string().trim().max(150).default(""),
  status: z.string().default("").transform((v) => v ? v.split(",") : []).pipe(z.array(z.enum(RETURN_STATUSES)).max(5)),
  type: z.enum(["REFUND", "EXCHANGE"]).optional(),
  from: date.optional(),
  to: date.optional(),
  cursor: z.string().min(1).max(160).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(RETURN_PAGE_SIZE),
}).refine((v) => !v.from || !v.to || v.from <= v.to, { message: "Start date must be before end date", path: ["to"] });
export type ReturnsQuery = z.infer<typeof returnsQuerySchema>;

export interface ReturnsSummary { total: number; pending: number; urgent: number }
export interface ReturnsPage {
  data: ReturnRequestRecord[];
  pagination: { total: number; nextCursor: string | null; pageSize: number };
  summary: ReturnsSummary;
  success: boolean;
  error: string | null;
}
export type ReturnAction = "approve" | "reject" | "complete";
export interface ReturnActionInput { action: ReturnAction; adminNote?: string; restock?: boolean }

/** Display the real request ID, not its unrelated order number. Never truncate identity. */
export function returnReference(id: string): string {
  return `#${id.startsWith("RET-") ? id : `RET-${id}`}`;
}
export function isUrgentReturn(item: Pick<ReturnRequestRecord, "status" | "createdAt">, now = Date.now()): boolean {
  return item.status === "PENDING" && now - Date.parse(item.createdAt) > 3 * 86_400_000;
}
export function statusAfterAction(action: ReturnAction): ReturnStatusKey {
  return action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "COMPLETED";
}

export function buildReturnsWhere(query: ReturnsQuery): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (query.status.length) where.status = { in: query.status };
  if (query.type) where.type = query.type;
  if (query.from || query.to) where.createdAt = {
    ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
    ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
  };
  if (query.q) {
    const contains = { contains: query.q.replace(/^#(?:RET-)?/i, ""), mode: "insensitive" };
    // Also search the original value, since some existing request IDs use RET-.
    where.OR = [
      { id: { contains: query.q.replace(/^#/, ""), mode: "insensitive" } },
      { id: contains },
      { orderId: { contains: query.q, mode: "insensitive" } },
      { order: { orderNumber: { contains: query.q.replace(/^#/, ""), mode: "insensitive" } } },
      { user: { name: { contains: query.q, mode: "insensitive" } } },
    ];
  }
  return where;
}

/** Protect spreadsheet exports from formula injection, not only commas/quotes. */
export function returnsToCsv(rows: readonly ReturnRequestRecord[]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [
    ["Request ID", "Order", "Customer", "Item", "Type", "Reason", "Status", "Created at"],
    ...rows.map((r) => [r.id, r.orderNumber, r.customerName, r.itemName, r.type, r.reason, r.status, r.createdAt]),
  ].map((row) => row.map(cell).join(",")).join("\r\n");
}
