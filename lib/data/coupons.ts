/**
 * Coupons data layer.
 *
 * Coupon rows live in Postgres only. Server-side validation lives in
 * `validateCoupon`, which the checkout can call once it moves off the
 * client-side table in `lib/cart.ts`.
 */

import { requireDatabase } from "@/lib/prisma";
import type { CouponType } from "@/types";

export interface CouponRecord {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrder: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  startDate?: string;
  endDate?: string;
  active: boolean;
}

/** Prisma enums (PERCENTAGE, FREE_SHIPPING) → the storefront's lowercase keys. */
function couponTypeFromEnum(value: unknown): CouponType {
  const normalised = String(value).trim().toLowerCase().replace(/_/g, "-");
  return normalised === "fixed" ? "fixed" : normalised === "free-shipping" ? "free-shipping" : "percentage";
}

function rowToCoupon(row: Record<string, unknown>): CouponRecord {
  return {
    id: String(row.id),
    code: String(row.code),
    type: couponTypeFromEnum(row.type),
    value: Number(row.value),
    minOrder: Number(row.minOrder),
    maxDiscount: row.maxDiscount == null ? undefined : Number(row.maxDiscount),
    usageLimit: row.usageLimit == null ? undefined : Number(row.usageLimit),
    usedCount: Number(row.usedCount ?? 0),
    startDate: row.startDate ? new Date(row.startDate as string).toISOString().slice(0, 10) : undefined,
    endDate: row.endDate ? new Date(row.endDate as string).toISOString().slice(0, 10) : undefined,
    active: Boolean(row.active),
  };
}

export async function listCoupons(): Promise<{
  coupons: CouponRecord[];
  source: "database";
}> {
  const coupons = await requireDatabase(async (db) => {
    const rows = (await db.coupon.findMany({ orderBy: { createdAt: "asc" } })) as unknown as Array<
      Record<string, unknown>
    >;
    return rows.map(rowToCoupon);
  });

  return { coupons, source: "database" };
}

export async function findCouponByCode(code: string): Promise<CouponRecord | null> {
  const wanted = code.trim().toUpperCase();

  return requireDatabase(async (db) => {
    const row = (await db.coupon.findUnique({ where: { code: wanted } })) as unknown as Record<
      string,
      unknown
    > | null;
    return row ? rowToCoupon(row) : null;
  });
}

export interface CouponValidation {
  valid: boolean;
  code: string;
  discount: number;
  message: string;
  coupon?: CouponRecord;
}

/** Server-side coupon check: expiry, usage limit, minimum order and discount maths. */
export async function validateCoupon(rawCode: string, subtotal: number): Promise<CouponValidation> {
  const code = rawCode.trim().toUpperCase();
  const coupon = await findCouponByCode(code);

  if (!coupon) {
    return { valid: false, code, discount: 0, message: "That code doesn't exist" };
  }
  if (!coupon.active) {
    return { valid: false, code, discount: 0, message: `${code} is no longer active` };
  }
  if (coupon.endDate && coupon.endDate < new Date().toISOString().slice(0, 10)) {
    return { valid: false, code, discount: 0, message: `${code} has expired` };
  }
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, code, discount: 0, message: `${code} has been fully redeemed` };
  }
  if (subtotal < coupon.minOrder) {
    return {
      valid: false,
      code,
      discount: 0,
      message: `Spend at least ${coupon.minOrder.toFixed(2)} to use ${code}`,
    };
  }

  const raw =
    coupon.type === "percentage"
      ? (subtotal * coupon.value) / 100
      : coupon.type === "fixed"
        ? coupon.value
        : 0;
  const capped = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;

  return {
    valid: true,
    code,
    discount: Math.round(Math.min(capped, subtotal) * 100) / 100,
    message: `${code} applied`,
    coupon,
  };
}
