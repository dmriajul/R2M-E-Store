/**
 * Console analytics, derived from real records.
 *
 * Every function here is pure: it takes the orders and products the console
 * already loaded from Postgres (see `app/admin/layout.tsx` →
 * `components/admin/AdminDataHydrator.tsx`) and reduces them. There is no
 * sample dataset anywhere in the console — an empty database produces empty
 * charts, and the panels say so.
 */

import type {
  AdminKpi,
  AdminNotification,
  AdminOrder,
  AdminOrderStatus,
  AdminProduct,
  Bestseller,
  BreakdownRow,
  RevenuePoint,
} from "@/types";

/** Statuses that count as money the store keeps. */
const REVENUE_STATUSES: ReadonlySet<AdminOrderStatus> = new Set([
  "confirmed",
  "processing",
  "shipped",
  "delivered",
]);

/** Orders whose totals belong in a revenue figure. */
export function revenueOrders(orders: readonly AdminOrder[]): AdminOrder[] {
  return orders.filter((order) => REVENUE_STATUSES.has(order.status));
}

const DAY = 86_400_000;

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function labelFor(day: Date, days: number): string {
  // A one-week window reads as weekday names; anything longer as "Sep 2".
  if (days <= 7) return WEEKDAY[day.getDay()] ?? "";
  return `${MONTH[day.getMonth()] ?? ""} ${day.getDate()}`;
}

/**
 * Daily revenue for the last `days` days, oldest first, zero-filled so the
 * chart always has the same number of bars.
 */
export function dailyRevenueSeries(
  orders: readonly AdminOrder[],
  days: number,
  now: Date = new Date(),
): RevenuePoint[] {
  const totals = new Map<number, number>();

  for (const order of revenueOrders(orders)) {
    const placed = new Date(order.placedAt);
    if (Number.isNaN(placed.getTime())) continue;
    const key = startOfDay(placed).getTime();
    totals.set(key, (totals.get(key) ?? 0) + order.totals.total);
  }

  const today = startOfDay(now);
  const points: RevenuePoint[] = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const day = new Date(today.getTime() - index * DAY);
    points.push({
      label: labelFor(day, days),
      value: Math.round((totals.get(day.getTime()) ?? 0) * 100) / 100,
    });
  }

  return points;
}

export interface RevenueSummary {
  total: number;
  average: number;
}

export function summariseRevenue(points: readonly RevenuePoint[]): RevenueSummary {
  const total = points.reduce((sum, point) => sum + point.value, 0);
  return {
    total: Math.round(total * 100) / 100,
    average: points.length === 0 ? 0 : Math.round((total / points.length) * 100) / 100,
  };
}

/** Top products by units sold, across the orders handed in. */
export function bestsellersFromOrders(
  orders: readonly AdminOrder[],
  limit = 5,
): Bestseller[] {
  const units = new Map<string, { name: string; unitsSold: number; revenue: number }>();

  for (const order of revenueOrders(orders)) {
    for (const item of order.items) {
      const entry = units.get(item.productId) ?? { name: item.name, unitsSold: 0, revenue: 0 };
      entry.unitsSold += item.quantity;
      entry.revenue += item.price * item.quantity;
      units.set(item.productId, entry);
    }
  }

  return Array.from(units.entries())
    .map(([productId, entry]) => ({
      productId,
      name: entry.name,
      unitsSold: entry.unitsSold,
      revenue: Math.round(entry.revenue),
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
    .slice(0, limit);
}

/**
 * Share of units sold per category, as whole percentages.
 *
 * Order lines only carry the product id, so the catalogue is used to resolve
 * each line's category; lines whose product has since been deleted are skipped.
 */
export function ordersByCategory(
  orders: readonly AdminOrder[],
  products: readonly AdminProduct[],
): BreakdownRow[] {
  const categoryById = new Map(products.map((product) => [product.id, product.category]));
  const units = new Map<string, number>();
  let totalUnits = 0;

  for (const order of revenueOrders(orders)) {
    for (const item of order.items) {
      const category = categoryById.get(item.productId);
      if (!category) continue;
      units.set(category, (units.get(category) ?? 0) + item.quantity);
      totalUnits += item.quantity;
    }
  }

  if (totalUnits === 0) return [];

  return Array.from(units.entries())
    .map(([label, count]) => ({ label, value: Math.round((count / totalUnits) * 100) }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** Orders whose `placedAt` falls inside the current calendar day. */
function placedOn(orders: readonly AdminOrder[], day: Date): AdminOrder[] {
  const target = startOfDay(day).getTime();
  return orders.filter((order) => {
    const placed = new Date(order.placedAt);
    return !Number.isNaN(placed.getTime()) && startOfDay(placed).getTime() === target;
  });
}

function unitsIn(orders: readonly AdminOrder[]): number {
  return orders.reduce(
    (sum, order) => sum + order.items.reduce((total, item) => total + item.quantity, 0),
    0,
  );
}

/** Percentage change of `current` against `previous`, rounded to one place. */
function trendFor(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** A seven-day sparkline ending today. */
function sparkFor(series: readonly number[]): number[] {
  return series.slice(-7);
}

/**
 * The four dashboard tiles, computed from the orders the console loaded.
 *
 * "Today" is compared against yesterday for the trend chip, which is the only
 * comparison an order table can honestly make.
 */
export function kpisFromOrders(
  orders: readonly AdminOrder[],
  now: Date = new Date(),
): AdminKpi[] {
  const counted = revenueOrders(orders);
  const today = placedOn(orders, now);
  const yesterday = placedOn(orders, new Date(now.getTime() - DAY));

  const revenueToday = today.reduce((sum, order) => sum + order.totals.total, 0);
  const revenueYesterday = yesterday.reduce((sum, order) => sum + order.totals.total, 0);

  const series = dailyRevenueSeries(counted, 7, now);
  const dailyOrderCounts = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startOfDay(now).getTime() - (6 - index) * DAY);
    return placedOn(orders, day).length;
  });
  const dailyUnitCounts = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startOfDay(now).getTime() - (6 - index) * DAY);
    return unitsIn(placedOn(orders, day));
  });

  return [
    {
      id: "revenue",
      emoji: "💰",
      label: "Today's Revenue",
      value: `৳${revenueToday.toLocaleString("en-BD")}`,
      trend: trendFor(revenueToday, revenueYesterday),
      trendUnit: "percent",
      spark: sparkFor(series.map((point) => point.value)),
    },
    {
      id: "orders",
      emoji: "📦",
      label: "Orders Today",
      value: String(today.length),
      trend: today.length - yesterday.length,
      trendUnit: "count",
      spark: sparkFor(dailyOrderCounts),
    },
    {
      id: "sold",
      emoji: "🧸",
      label: "Units Sold Today",
      value: String(unitsIn(today)),
      trend: unitsIn(today) - unitsIn(yesterday),
      trendUnit: "count",
      spark: sparkFor(dailyUnitCounts),
    },
    {
      id: "customers",
      emoji: "👥",
      label: "Orders (all time)",
      value: String(orders.length),
      trend: 0,
      trendUnit: "count",
      spark: sparkFor(dailyOrderCounts),
    },
  ];
}

/* -------------------------------------------------------------------------- */
/*  Console notifications                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The bell dropdown, built from what actually needs attention:
 * orders awaiting a manual payment decision and products at or below their
 * low-stock threshold. An empty database means an empty bell.
 */
export function notificationsFromRecords(
  orders: readonly AdminOrder[],
  products: readonly AdminProduct[],
  limit = 6,
): AdminNotification[] {
  const pending: AdminNotification[] = orders
    .filter((order) => order.paymentStatus === "PENDING")
    .map((order) => ({
      id: `pending-payment-${order.id}`,
      emoji: "🛒",
      title: `Payment to verify on ${order.number} — ৳${order.totals.total.toLocaleString("en-BD")}`,
      createdAt: order.placedAt,
      href: "/admin/orders",
      read: false,
    }));

  const lowStock: AdminNotification[] = products
    .filter(
      (product) =>
        product.status === "active" &&
        product.stock > 0 &&
        product.stock <= product.lowStockThreshold,
    )
    .map((product) => ({
      id: `low-stock-${product.id}`,
      emoji: "⚠️",
      title: `${product.name} is low on stock (${product.stock} left)`,
      createdAt: product.createdAt,
      href: "/admin/products",
      read: false,
    }));

  return [...pending, ...lowStock]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}
