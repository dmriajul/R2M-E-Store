/**
 * Admin orders data layer.
 *
 * The console reads and writes the same `Order` rows the storefront creates —
 * status changes, manual-wallet verification and internal notes all persist in
 * Postgres.
 *
 * Deliberately **not** built on `withDatabase()`: that helper swallows failures
 * and serves mock data, which is right for the storefront but wrong for an
 * authenticated admin action. Here a write either commits or throws, and the
 * Server Action turns the throw into an error toast. Reads return `null` when no
 * database is configured so the console can keep its in-session demo list.
 */

import { AdminDataError } from "@/lib/data/admin-errors";
import { buildAdminTimeline } from "@/lib/mock-admin";
import { getPrisma, type PrismaLikeClient } from "@/lib/prisma";
import { getPaymentMethod } from "@/lib/payments";
import { toProductCategory } from "@/lib/data/products";
import { CATEGORY_META } from "@/lib/site";
import { buildLineId } from "@/types";
import type {
  Address,
  AdminOrder,
  AdminOrderStatus,
  CartItem,
  PaymentStatusKey,
} from "@/types";

/* -------------------------------------------------------------------------- */
/*  Rows                                                                      */
/* -------------------------------------------------------------------------- */

interface OrderItemRow {
  id: string;
  productId: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  product?: { category: string | null; ageRange: string | null; stock: number } | null;
}

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentRef: string | null;
  subtotal: number;
  shipping: number;
  discount: number;
  giftWrap: number;
  total: number;
  shippingName: string;
  shippingEmail: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingZip: string;
  shippingCountry: string;
  notes: string | null;
  trackingNumber: string | null;
  createdAt: Date | string;
  items: OrderItemRow[];
}

const orderInclude = {
  items: {
    include: {
      product: { select: { category: true, ageRange: true, stock: true } },
    },
  },
} as const;

/* -------------------------------------------------------------------------- */
/*  Enum mapping — the console's lowercase statuses ↔ the Prisma enums        */
/* -------------------------------------------------------------------------- */

/**
 * Database status → the console's own vocabulary. `CONFIRMED` is the state a
 * verified manual wallet payment lands in and is shown as **Confirmed**; the
 * team moves the order to *Processing* when preparation actually starts.
 */
const UI_ORDER_STATUS: Readonly<Record<string, AdminOrderStatus>> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
};

/** Console status → Prisma `OrderStatus`. */
export const ORDER_STATUS_FOR_DB: Readonly<Record<AdminOrderStatus, string>> = {
  pending: "PENDING",
  confirmed: "CONFIRMED",
  processing: "PROCESSING",
  shipped: "SHIPPED",
  delivered: "DELIVERED",
  cancelled: "CANCELLED",
  refunded: "REFUNDED",
};

const PAYMENT_STATUSES: readonly PaymentStatusKey[] = [
  "UNPAID",
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
];

function toPaymentStatus(value: string): PaymentStatusKey {
  return PAYMENT_STATUSES.includes(value as PaymentStatusKey)
    ? (value as PaymentStatusKey)
    : "UNPAID";
}

/** Notes are one text column, so they are stored line-per-note. */
export function splitOrderNotes(notes: string | null | undefined): string[] {
  if (!notes) return [];
  return notes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/* -------------------------------------------------------------------------- */
/*  Row → console record                                                      */
/* -------------------------------------------------------------------------- */

function toCartItem(row: OrderItemRow, addedAt: string): CartItem {
  const category = toProductCategory(row.product?.category ?? "Accessories");
  const meta = CATEGORY_META[category];

  return {
    lineId: buildLineId(row.productId, row.color, row.size),
    orderItemId: row.id,
    productId: row.productId,
    id: row.productId,
    name: row.name,
    price: row.price,
    quantity: row.quantity,
    color: row.color,
    size: row.size,
    ageRange: row.product?.ageRange ?? "0-12Y",
    imageGradient: meta.gradient,
    emoji: meta.emoji,
    stock: row.product?.stock ?? 0,
    addedAt,
  };
}

function toShippingAddress(row: OrderRow): Address {
  return {
    id: `order-${row.id}`,
    label: "Shipping",
    fullName: row.shippingName,
    line1: row.shippingAddress,
    city: row.shippingCity,
    postalCode: row.shippingZip,
    country: row.shippingCountry,
    phone: row.shippingPhone,
    isDefault: true,
  };
}

/** Database row → the record the console renders. */
export function toAdminOrder(row: OrderRow): AdminOrder {
  const placedAt = row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt;
  const paymentMethod = getPaymentMethod(row.paymentMethod);
  const notes = splitOrderNotes(row.notes);

  const order: AdminOrder = {
    id: row.id,
    number: `#${row.orderNumber}`,
    customer: {
      name: row.shippingName,
      email: row.shippingEmail,
      phone: row.shippingPhone,
    },
    items: row.items.map((line) => toCartItem(line, placedAt)),
    totals: {
      subtotal: row.subtotal,
      shipping: row.shipping,
      giftWrap: row.giftWrap,
      discount: row.discount,
      total: row.total,
    },
    status: UI_ORDER_STATUS[row.status] ?? "pending",
    paymentMethod: paymentMethod.name,
    paymentStatus: toPaymentStatus(row.paymentStatus),
    ...(row.paymentRef ? { paymentRef: row.paymentRef } : {}),
    placedAt,
    shipping: toShippingAddress(row),
    notes,
    timeline: [],
  };

  order.timeline = buildAdminTimeline(order);
  return order;
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Every order in the console's shape, newest first.
 * `null` means "no database configured" — not "no orders".
 */
export async function getAdminOrders(): Promise<AdminOrder[] | null> {
  const db = await getPrisma();
  if (!db) return null;

  try {
    const rows = (await db.order.findMany({
      include: orderInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    })) as unknown as OrderRow[];

    return rows.map(toAdminOrder);
  } catch (error) {
    // Reads degrade to the in-session demo list; writes never do.
    console.error("[admin/orders] Could not load orders", error);
    return null;
  }
}

/** A single order, freshly mapped. Throws when the row does not exist. */
export async function getAdminOrder(orderNumber: string): Promise<AdminOrder> {
  const db = await requireDatabase();
  const row = await db.order.findUnique({
    where: { orderNumber },
    include: orderInclude,
  });
  if (!row) throw new AdminDataError(`Order ${orderNumber} was not found`);

  return toAdminOrder(row as unknown as OrderRow);
}

/* -------------------------------------------------------------------------- */
/*  Writes                                                                    */
/* -------------------------------------------------------------------------- */

async function requireDatabase(): Promise<PrismaLikeClient> {
  const db = await getPrisma();
  if (!db) {
    throw new AdminDataError(
      "No database connection — set DATABASE_URL and run `npx prisma generate`",
    );
  }
  return db;
}

interface OrderWrite {
  status?: string;
  paymentStatus?: PaymentStatusKey;
  notes?: string;
  trackingNumber?: string | null;
  paymentRef?: string | null;
}

async function writeOrder(
  orderNumber: string,
  data: OrderWrite,
  db: PrismaLikeClient,
): Promise<AdminOrder> {
  try {
    const row = await db.order.update({
      where: { orderNumber },
      data,
      include: orderInclude,
    });
    return toAdminOrder(row as unknown as OrderRow);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code === "P2025") {
      throw new AdminDataError(
        `Order ${orderNumber} was not found in the database — reload the console`,
      );
    }
    throw error;
  }
}

/** Appends one operator note to the order's line-per-note text column. */
async function notesWith(
  orderNumber: string,
  note: string,
  db: PrismaLikeClient,
): Promise<string> {
  const current = (await db.order.findUnique({
    where: { orderNumber },
    select: { notes: true },
  })) as { notes: string | null } | null;

  return [...splitOrderNotes(current?.notes ?? null), note].join("\n");
}

/**
 * Moves an order along the fulfilment flow (Pending → Processing → Shipped →
 * Delivered, or Cancelled / Refunded). An optional note is appended to the
 * order's audit trail.
 */
export async function updateAdminOrderStatus(
  orderNumber: string,
  status: AdminOrderStatus,
  note?: string,
): Promise<AdminOrder> {
  const db = await requireDatabase();
  const data: OrderWrite = { status: ORDER_STATUS_FOR_DB[status] };

  if (note?.trim()) data.notes = await notesWith(orderNumber, note.trim(), db);

  return writeOrder(orderNumber, data, db);
}

export type PaymentDecision = "approve" | "reject" | "collect-cash";

/**
 * Records the operator's decision on a manual payment.
 *
 * - `approve` (bKash / Nagad / Rocket screenshot checked) → **CONFIRMED + PAID**
 * - `reject`  (transfer could not be matched)             → **CANCELLED + FAILED**
 * - `collect-cash` (COD parcel handed over)               → **DELIVERED + PAID**
 *
 * The first two mirror `resolveManualPayment()` in `lib/data/orders.ts`, which
 * the storefront payment endpoint uses, so both entry points agree.
 */
export async function decideAdminManualPayment(
  orderNumber: string,
  decision: PaymentDecision,
): Promise<AdminOrder> {
  const db = await requireDatabase();

  if (decision === "collect-cash") {
    return writeOrder(
      orderNumber,
      {
        status: "DELIVERED",
        paymentStatus: "PAID",
        notes: await notesWith(
          orderNumber,
          "Cash collected by the delivery partner.",
          db,
        ),
      },
      db,
    );
  }

  const approved = decision === "approve";
  return writeOrder(
    orderNumber,
    {
      status: approved ? "CONFIRMED" : "CANCELLED",
      paymentStatus: approved ? "PAID" : "FAILED",
      notes: await notesWith(
        orderNumber,
        approved
          ? "Payment verified by an operator."
          : "Payment could not be verified — order cancelled.",
        db,
      ),
    },
    db,
  );
}

/** Adds a free-text note without touching the status. */
export async function appendAdminOrderNote(
  orderNumber: string,
  note: string,
): Promise<AdminOrder> {
  const db = await requireDatabase();
  const trimmed = note.trim();
  if (!trimmed) throw new AdminDataError("Write a note first");

  return writeOrder(
    orderNumber,
    { notes: await notesWith(orderNumber, trimmed, db) },
    db,
  );
}

/** Full refund: money returned, order closed. */
export async function refundAdminOrder(
  orderNumber: string,
  note = "Refund issued in full.",
): Promise<AdminOrder> {
  const db = await requireDatabase();

  return writeOrder(
    orderNumber,
    {
      status: "REFUNDED",
      paymentStatus: "REFUNDED",
      notes: await notesWith(orderNumber, note, db),
    },
    db,
  );
}
