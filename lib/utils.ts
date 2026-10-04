import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names and resolve conflicting Tailwind utilities.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a numeric price as a localized currency string.
 */
export function formatPrice(
  amount: number,
  currency: string = "USD",
  locale: string = "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Build a URL-safe slug from an arbitrary string.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Formats an ISO date for delivery estimates, e.g. "Friday, 17 October".
 */
export function formatDeliveryDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

/* -------------------------------------------------------------------------- */
/*  Deterministic date formatting (dashboard)                                 */
/*                                                                            */
/*  Order stamps are rendered during SSR *and* on hydration, so they must not  */
/*  depend on the visitor's clock or locale — every helper below reads the     */
/*  UTC fields of a fixed ISO instant. That keeps the server HTML and the      */
/*  client render byte-identical (no hydration mismatch, no ICU variance).     */
/* -------------------------------------------------------------------------- */

const MONTHS = [
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

function parseIso(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function unitLabel(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** "Sep 26, 2026" — pinned to UTC so SSR and hydration agree. */
export function formatShortDate(iso: string): string {
  const date = parseIso(iso);
  if (!date) return iso;
  const month = MONTHS[date.getUTCMonth()] ?? "";
  return `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** "Oct 1, 2026, 9:00 AM" — used by the tracking timeline. */
export function formatStamp(iso: string): string {
  const date = parseIso(iso);
  if (!date) return iso;

  const month = MONTHS[date.getUTCMonth()] ?? "";
  const hour24 = date.getUTCHours();
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const meridiem = hour24 < 12 ? "AM" : "PM";

  return `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}, ${hour}:${minutes} ${meridiem}`;
}

/**
 * Relative label between two fixed instants: "2 hours ago", "3 days ago",
 * "yesterday", "tomorrow", "in 2 days", "1 week ago".
 *
 * `anchorIso` is the demo's frozen "now" (see `lib/mock-dashboard.ts`), so the
 * copy never drifts between the server and the browser.
 */
export function formatRelative(iso: string, anchorIso: string): string {
  const target = parseIso(iso);
  const anchor = parseIso(anchorIso);
  if (!target || !anchor) return "";

  const diff = target.getTime() - anchor.getTime();
  const abs = Math.abs(diff);

  // Calendar-day distance, so "tomorrow at midnight" reads as tomorrow even
  // though it is only a few hours away.
  const days = Math.round(
    (Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()) -
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate())) /
      86_400_000,
  );

  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";

  const distance = Math.abs(days);

  const text =
    abs < 3_600_000
      ? unitLabel(Math.max(1, Math.round(abs / 60_000)), "minute")
      : abs < 86_400_000
        ? unitLabel(Math.max(1, Math.round(abs / 3_600_000)), "hour")
        : distance < 7
          ? unitLabel(distance, "day")
          : unitLabel(Math.max(1, Math.round(distance / 7)), "week");

  return diff < 0 ? `${text} ago` : `in ${text}`;
}

/** "Sarah Ahmed" → "SA"; falls back to the brand initials for empty names. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return `${first}${last}`.toUpperCase() || "LL";
}

/** "2025-01-10" → "January 2025". */
export function formatMonthYear(iso: string): string {
  const date = parseIso(iso);
  if (!date) return iso;
  const long = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return long;
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** "Wednesday, October 1, 2026" — UTC-pinned like the other admin helpers. */
export function formatLongDate(iso: string): string {
  const date = parseIso(iso);
  if (!date) return iso;

  const weekday = WEEKDAYS[date.getUTCDay()] ?? "";
  const month = MONTHS_LONG[date.getUTCMonth()] ?? "";
  return `${weekday}, ${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** "Oct 1" — compact chart/tooltip label. */
export function formatDayMonth(iso: string): string {
  const date = parseIso(iso);
  if (!date) return iso;
  const month = MONTHS[date.getUTCMonth()] ?? "";
  return `${month} ${date.getUTCDate()}`;
}
