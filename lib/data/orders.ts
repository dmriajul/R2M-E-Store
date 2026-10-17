/**
 * Orders data layer.
 *
 * `POST /api/orders` writes a real row when Postgres is reachable. Without a
 * database the same order is kept in a module-level list so the demo can still
 * create orders, list them and verify payments — the storefront behaviour is
 * identical, only the durability differs.
 */

import { CATEGORY_META, getProductById } from "@/lib/site";
import { computeTotals, lookupCoupon } from "@/lib/cart";
import { validateCoupon } from "@/lib/data/coupons";
import { withDatabase, withRequiredDatabase } from "@/lib/prisma";
import {
  generateOrderNumber,
  getPaymentMethod,
  initialOrderState,
  isManualPayment,
} from "@/lib/payments";
import type {
  CartItem,
  CreateOrderInput,
  OrderRecord,
  PaymentKey,
  PaymentStatusKey,
} from "@/types";

/** Rounds money to cents, matching `lib/cart.ts`. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Demo-only order log (cleared on server restart). */
const orderScope = globalThis as typeof globalThis & {
  __mukraDemoOrders?: OrderRecord[];
  __mukraDemoOrderOwners?: Map<string, string>;
};
const memoryOrders = (orderScope.__mukraDemoOrders ??= []);
const memoryOrderOwners = (orderScope.__mukraDemoOrderOwners ??= new Map<string, string>());

function lineToCartItem(line: CreateOrderInput["items"][number], index: number): CartItem {
  const product = getProductById(line.productId);
  const category = product?.category ?? "Accessories";

  return {
    lineId: `${line.productId}-${line.color}-${line.size}-${index}`,
    productId: line.productId,
    id: line.productId,
    name: line.name,
    price: line.price,
    quantity: line.quantity,
    color: line.color,
    size: line.size,
    ageRange: product?.ageRange ?? "3-8Y",
    imageGradient: CATEGORY_META[category].gradient,
    emoji: CATEGORY_META[category].emoji,
    stock: product
      ? product.variants
        ? (product.variants.find(
            (variant) => variant.color === line.color && variant.size === line.size,
          )?.stock ?? 0)
        : product.stock
      : 0,
    addedAt: new Date().toISOString(),
  };
}

export interface PlaceOrderResult {
  order: OrderRecord;
  source: "database" | "mock";
}

/**
 * Creates an order: totals are recomputed here (never trusted from the client),
 * the order number is generated, and the payment state follows the method —
 * COD is confirmed + unpaid, wallets are pending until an admin verifies.
 */
export async function createOrder(
  input: CreateOrderInput,
  user: { id?: string; name: string; email: string },
): Promise<PlaceOrderResult> {
  const method = input.payment?.method ?? "COD";
  const cart = input.items.map(lineToCartItem);

  /* Totals are recomputed here — the client's numbers are never trusted. */
  const base = computeTotals(cart, {
    method: input.shipping.method,
    giftWrap: input.shipping.giftWrap,
  });

  const couponCode = input.couponCode?.trim();
  const stored = couponCode ? await validateCoupon(couponCode, base.subtotal) : null;
  // The checkout's own percentage table (WELCOME15, LITTLE10…) stays valid too.
  const legacy = couponCode && !stored?.valid ? lookupCoupon(couponCode) : null;

  const discount = round(
    stored?.valid ? stored.discount : legacy ? (base.subtotal * legacy.percent) / 100 : 0,
  );
  const freeShipping = stored?.valid && stored.coupon?.type === "free-shipping";
  const shipping = freeShipping ? 0 : base.shipping;

  const totals = {
    ...base,
    shipping,
    discount,
    total: round(Math.max(0, base.subtotal + shipping + base.giftWrap - discount)),
  };

  const { status, paymentStatus } = initialOrderState(method);
  const orderNumber = generateOrderNumber();
  const estimated = new Date(
    Date.now() + (input.shipping.method === "express" ? 3 : 7) * 86_400_000,
  );

  const record: OrderRecord = {
    id: orderNumber,
    orderNumber,
    status,
    paymentStatus,
    paymentMethod: method,
    paymentRef: input.payment.screenshotUrl,
    subtotal: totals.subtotal,
    shipping: totals.shipping,
    discount: totals.discount,
    giftWrap: totals.giftWrap,
    total: totals.total,
    items: input.items,
    customerName: input.contact.name,
    email: input.contact.email,
    phone: input.contact.phone,
    address: input.shipping.address,
    city: input.shipping.city,
    zip: input.shipping.zip,
    country: input.shipping.country,
    estimatedDelivery: estimated.toISOString(),
    createdAt: new Date().toISOString(),
    source: "mock",
  };

  const { data, source } = await withRequiredDatabase<OrderRecord>(
    async (db) => {
      // Aggregate requested quantities per product/variant so a single atomic
      // decrement is issued for each (prevents overselling on duplicate lines).
      const aggregate = new Map<
        string,
        { productId: string; color: string; size: string; quantity: number }
      >();
      for (const line of input.items) {
        const key = `${line.productId}\u0000${line.color}\u0000${line.size}`;
        const previous = aggregate.get(key);
        aggregate.set(key, {
          productId: line.productId,
          color: line.color,
          size: line.size,
          quantity: (previous?.quantity ?? 0) + line.quantity,
        });
      }

      const created = await db.$transaction(async (tx) => {
        // Atomically decrement stock; fail the whole transaction if any line
        // cannot be satisfied (SELECT ... FOR UPDATE semantics via conditional
        // updateMany).
        for (const entry of aggregate.values()) {
          const product = (await tx.product.findUnique({
            where: { id: entry.productId },
            include: { variants: true },
          })) as {
            id: string;
            name: string;
            variants: Array<{
              id: string;
              color: string;
              size: string;
              stock: number;
            }>;
          } | null;

          if (!product) {
            throw new Error(`Product not found: ${entry.productId}`);
          }

          if (product.variants && product.variants.length > 0) {
            const variant = product.variants.find(
              (candidate) => candidate.color === entry.color && candidate.size === entry.size,
            );
            if (!variant) {
              throw new Error(`Variant not found for ${product.name}`);
            }
            const result = (await tx.productVariant.updateMany({
              where: { id: variant.id, stock: { gte: entry.quantity } },
              data: { stock: { decrement: entry.quantity } },
            })) as { count: number };
            if (result.count === 0) {
              throw new Error(`Not enough stock for: ${product.name}`);
            }
          } else {
            const result = (await tx.product.updateMany({
              where: { id: product.id, stock: { gte: entry.quantity } },
              data: { stock: { decrement: entry.quantity } },
            })) as { count: number };
            if (result.count === 0) {
              throw new Error(`Not enough stock for: ${product.name}`);
            }
          }
        }

        if (!user.id) throw new Error("Sign in before placing an order");
        if (input.shipping.saveAddress) {
          const address = {
            userId: user.id,
            name: input.contact.name,
            phone: input.contact.phone,
            address1: input.shipping.address,
            city: input.shipping.city,
            state: input.shipping.state ?? null,
            zip: input.shipping.zip,
            country: input.shipping.country,
          };
          const existing = await tx.address.findFirst({ where: address });
          if (!existing) await tx.address.create({ data: address });
        }

        const row = (await tx.order.create({
          data: {
            orderNumber,
            userId: user.id,
            subtotal: totals.subtotal,
            shipping: totals.shipping,
            discount: totals.discount,
            giftWrap: totals.giftWrap,
            total: totals.total,
            status,
            paymentMethod: method,
            paymentStatus,
            paymentRef: input.payment.screenshotUrl ?? null,
            shippingName: input.contact.name,
            shippingEmail: input.contact.email,
            shippingPhone: input.contact.phone,
            shippingAddress: input.shipping.address,
            shippingCity: input.shipping.city,
            shippingZip: input.shipping.zip,
            shippingCountry: input.shipping.country,
            estimatedDelivery: estimated,
            items: {
              create: input.items.map((line) => ({
                productId: line.productId,
                name: line.name,
                color: line.color,
                size: line.size,
                quantity: line.quantity,
                price: line.price,
              })),
            },
          },
        })) as { id: string };

        return row;
      });

      return { ...record, id: created.id, source: "database" as const };
    },
    () => {
      const demo: OrderRecord = { ...record, id: `demo-${orderNumber}` };
      memoryOrders.unshift(demo);
      if (user.id) memoryOrderOwners.set(demo.id, user.id);
      return demo;
    },
  );

  return { order: { ...data, source }, source };
}

/** Orders for the signed-in shopper (database) or the demo log (mock). */
export async function listOrdersForEmail(
  email: string,
  userId?: string,
): Promise<{ orders: OrderRecord[]; source: "database" | "mock" }> {
  const { data, source } = await withRequiredDatabase<OrderRecord[]>(
    async (db) => {
      const rows = (await db.order.findMany({
        where: userId ? { userId } : { shippingEmail: email },
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: { product: { select: { sizes: true, colors: true } } },
          },
        },
      })) as unknown as Array<Record<string, unknown>>;

      return rows.map((row) => hydrate(row));
    },
    () =>
      memoryOrders.filter((order) =>
        userId ? memoryOrderOwners.get(order.id) === userId : order.email === email,
      ),
  );

  return { orders: data, source };
}

export async function findOrderByNumber(orderNumber: string): Promise<OrderRecord | null> {
  const { data } = await withDatabase<OrderRecord | null>(
    async (db) => {
      const row = (await db.order.findFirst({
        where: { orderNumber },
        include: {
          items: {
            include: { product: { select: { sizes: true, colors: true } } },
          },
        },
      })) as unknown as Record<string, unknown> | null;
      return row ? hydrate(row) : null;
    },
    () => memoryOrders.find((order) => order.orderNumber === orderNumber) ?? null,
  );

  return data;
}

/**
 * Admin decision on a manual payment.
 * `approve` → CONFIRMED + PAID, `reject` → CANCELLED + FAILED.
 */
export async function resolveManualPayment(
  orderNumber: string,
  decision: "approve" | "reject",
): Promise<{ order: OrderRecord | null; source: "database" | "mock" }> {
  const nextStatus = decision === "approve" ? "CONFIRMED" : "CANCELLED";
  const nextPayment: PaymentStatusKey = decision === "approve" ? "PAID" : "FAILED";

  const { data, source } = await withDatabase<OrderRecord | null>(
    async (db) => {
      const row = (await db.order.update({
        where: { orderNumber },
        data: { status: nextStatus, paymentStatus: nextPayment },
        include: { items: true },
      })) as unknown as Record<string, unknown>;
      return hydrate(row);
    },
    () => {
      const found = memoryOrders.find((order) => order.orderNumber === orderNumber);
      if (!found) return null;
      found.status = nextStatus;
      found.paymentStatus = nextPayment;
      return found;
    },
  );

  return { order: data, source };
}

/** "Mark as paid" once a COD parcel has been handed over. */
export async function markCashCollected(orderNumber: string): Promise<boolean> {
  const { data } = await withDatabase<boolean>(
    async (db) => {
      await db.order.update({
        where: { orderNumber },
        data: { paymentStatus: "PAID", status: "DELIVERED" },
      });
      return true;
    },
    () => {
      const found = memoryOrders.find((order) => order.orderNumber === orderNumber);
      if (!found) return false;
      found.paymentStatus = "PAID";
      found.status = "DELIVERED";
      return true;
    },
  );

  return data;
}

/** Row → `OrderRecord` (numbers/ISO strings, no Prisma types leaking). */
function hydrate(row: Record<string, unknown>): OrderRecord {
  const items = Array.isArray(row.items) ? (row.items as Array<Record<string, unknown>>) : [];
  const asIso = (value: unknown): string | undefined =>
    value instanceof Date ? value.toISOString() : typeof value === "string" ? value : undefined;

  return {
    id: String(row.id),
    orderNumber: String(row.orderNumber),
    status: row.status as OrderRecord["status"],
    paymentStatus: row.paymentStatus as PaymentStatusKey,
    paymentMethod: row.paymentMethod as PaymentKey,
    paymentRef: (row.paymentRef as string | null) ?? undefined,
    subtotal: Number(row.subtotal),
    shipping: Number(row.shipping),
    discount: Number(row.discount),
    giftWrap: Number(row.giftWrap),
    total: Number(row.total),
    items: items.map((line) => ({
      id: typeof line.id === "string" ? line.id : undefined,
      productId: String(line.productId),
      name: String(line.name),
      color: String(line.color),
      size: String(line.size),
      quantity: Number(line.quantity),
      price: Number(line.price),
      availableSizes: Array.isArray((line.product as Record<string, unknown> | undefined)?.sizes)
        ? ((line.product as Record<string, unknown>).sizes as string[])
        : undefined,
      availableColors: Array.isArray((line.product as Record<string, unknown> | undefined)?.colors)
        ? ((line.product as Record<string, unknown>).colors as string[])
        : undefined,
    })),
    customerName: String(row.shippingName),
    email: String(row.shippingEmail),
    phone: String(row.shippingPhone),
    address: String(row.shippingAddress),
    city: String(row.shippingCity),
    zip: String(row.shippingZip),
    country: String(row.shippingCountry ?? "Bangladesh"),
    notes: (row.notes as string | null) ?? undefined,
    trackingNumber: (row.trackingNumber as string | null) ?? undefined,
    estimatedDelivery: asIso(row.estimatedDelivery),
    createdAt: asIso(row.createdAt) ?? new Date().toISOString(),
    source: "database",
  };
}

/** Copy used by the confirmation screen and the order API response. */
export function paymentInstructionsFor(order: OrderRecord): string[] {
  const config = getPaymentMethod(order.paymentMethod);
  if (!config.numbers || !isManualPayment(config.key)) return [];
  return [...config.numbers];
}
