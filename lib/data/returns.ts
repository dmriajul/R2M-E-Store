import type { ReturnRequestRecord, ReturnStatusKey, ReturnTypeKey } from "@/types";

type ReturnRow = Record<string, unknown>;

const object = (value: unknown): ReturnRow =>
  value && typeof value === "object" ? (value as ReturnRow) : {};

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

export function hydrateReturnRequest(row: ReturnRow): ReturnRequestRecord {
  const order = object(row.order);
  const user = object(row.user);
  const item = object(row.orderItem);
  const createdAt = row.createdAt instanceof Date
    ? row.createdAt.toISOString()
    : String(row.createdAt);
  const updatedAt = row.updatedAt instanceof Date
    ? row.updatedAt.toISOString()
    : String(row.updatedAt);

  return {
    id: String(row.id),
    orderId: String(row.orderId),
    orderNumber: String(order.orderNumber ?? ""),
    userId: String(row.userId),
    customerName: String(user.name ?? ""),
    customerEmail: String(user.email ?? ""),
    customerPhone: String(user.phone ?? ""),
    orderItemId: String(row.orderItemId),
    itemName: String(item.name ?? ""),
    itemSize: String(item.size ?? ""),
    itemColor: String(item.color ?? ""),
    quantity: Number(item.quantity ?? 0),
    type: row.type as ReturnTypeKey,
    reason: String(row.reason),
    details: optionalString(row.details),
    requestedSize: optionalString(row.requestedSize),
    requestedColor: optionalString(row.requestedColor),
    images: Array.isArray(row.images) ? row.images.filter((image): image is string => typeof image === "string") : [],
    status: row.status as ReturnStatusKey,
    adminNote: optionalString(row.adminNote),
    createdAt,
    updatedAt,
  };
}

export const returnRequestInclude = {
  order: { select: { orderNumber: true } },
  user: { select: { name: true, email: true, phone: true } },
  orderItem: { select: { name: true, size: true, color: true, quantity: true } },
};
