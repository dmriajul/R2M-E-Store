/**
 * Coupons data layer.
 *
 * The seed mirrors the four demo codes the admin console already shows
 * (`WELCOME10`, `SUMMER25`, `FREESHIP`, `BIRTHDAY`). Server-side validation
 * lives in `validateCoupon`, which the checkout can call once it moves off the
 * client-side table in `lib/cart.ts`.
 */

import { withDatabase } from "@/lib/prisma";
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

/** Mirrors `ADMIN_COUPONS` in `lib/mock-admin.ts`. */
export const MOCK_COUPONS: readonly CouponRecord[] = [
  {
    id: "coupon-welcome10",
    code: "WELCOME10",
    type: "percentage",
    value: 10,
    minOrder: 50,
    usageLimit: 100,
    usedCount: 45,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    active: true,
  },
  {
    id: "coupon-summer25",
    code: "SUMMER25",
    type: "fixed",
    value: 25,
    minOrder: 100,
    usageLimit: 50,
    usedCount: 12,
    startDate: "2026-06-01",
    endDate: "2026-11-30",
    active: true,
  },
  {
    id: "coupon-freeship",
    code: "FREESHIP",
    type: "free-shipping",
    value: 0,
    minOrder: 0,
    usedCount: 89,
    startDate: "2026-02-01",
    endDate: "2026-12-31",
    active: true,
  },
  {
    id: "coupon-birthday",
    code: "BIRTHDAY",
    type: "percentage",
    value: 20,
    minOrder: 30,
    usageLimit: 20,
    usedCount: 5,
    startDate: "2026-06-01",
    endDate: "2026-08-15",
    active: false,
  },
] as const;

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
  source: "database" | "mock";
}> {
  const { data, source } = await withDatabase<CouponRecord[]>(
    async (db) => {
      const rows = (await db.coupon.findMany({ orderBy: { createdAt: "asc" } })) as unknown as Array<
        Record<string, unknown>
      >;
      return rows.map(rowToCoupon);
    },
    () => [...MOCK_COUPONS],
  );

  return { coupons: data, source };
}

export async function findCouponByCode(code: string): Promise<CouponRecord | null> {
  const wanted = code.trim().toUpperCase();

  const { data } = await withDatabase<CouponRecord | null>(
    async (db) => {
      const row = (await db.coupon.findUnique({ where: { code: wanted } })) as unknown as Record<
        string,
        unknown
      > | null;
      return row ? rowToCoupon(row) : null;
    },
    () => MOCK_COUPONS.find((coupon) => coupon.code === wanted) ?? null,
  );

  return data;
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
