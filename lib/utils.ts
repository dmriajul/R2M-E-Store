import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useLanguageStore, type Language } from "@/store/useLanguageStore";

/** Merge conditional class names and resolve conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a numeric price as a localized BDT currency string.
 * Uses Bangladeshi Taka (৳) with no decimals.
 */
export function formatPrice(
  amount: number,
  currency: string = "BDT",
  locale: string = "en-BD",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format price for Bengali locale display.
 */
export function formatPriceBn(amount: number): string {
  return new Intl.NumberFormat("bn-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Build a URL-safe slug from an arbitrary string. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Formats an ISO date for delivery estimates, e.g. "Friday, 17 October". */
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

/* -------------------------------------------------------------------------- */
/*  i18n helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Get localized text based on current language setting. */
export function t(key: string, language?: Language): string {
  const lang = language ?? useLanguageStore.getState().language;

  const translations: Record<string, Record<Language, string>> = {
    // Navigation
    "nav.home": { en: "Home", bn: "হোম" },
    "nav.shop": { en: "Shop", bn: "দেখুন" },
    "nav.collections": { en: "Collections", bn: "সংগ্রহ" },
    "nav.about": { en: "About", bn: "পরিচয়" },
    "nav.search": { en: "Search", bn: "অনুসন্ধান" },
    "nav.cart": { en: "Cart", bn: "কার্ট" },
    "nav.account": { en: "Account", bn: "অ্যাকাউন্ট" },

    // Cart
    "cart.empty": { en: "Your bag is empty", bn: "আপনার কার্ট খালি" },
    "cart.items": { en: "items", bn: "আইটেম" },
    "cart.total": { en: "Total", bn: "মোট" },
    "cart.checkout": { en: "Checkout", bn: "চেকআউট" },
    "cart.continue": { en: "Continue Shopping", bn: "শপিং চালিয়ে যান" },

    // Product
    "product.add_to_cart": { en: "Add to Cart", bn: "কার্টে যোগ করুন" },
    "product.view_details": { en: "View Details", bn: "বিস্তারিত দেখুন" },
    "product.in_stock": { en: "In Stock", bn: "স্টক আছে" },
    "product.out_of_stock": { en: "Out of Stock", bn: "স্টক নেই" },
    "product.quick_view": { en: "Quick View", bn: "দ্রুত দেখুন" },

    // Checkout
    "checkout.shipping": { en: "Shipping", bn: "শিপিং" },
    "checkout.payment": { en: "Payment", bn: "পেমেন্ট" },
    "checkout.confirm": { en: "Confirm", bn: "নিশ্চিত করুন" },
    "checkout.place_order": { en: "Place Order", bn: " অর্ডার করুন" },
    "checkout.total": { en: "Order Total", bn: "অর্ডার মোট" },

    // Payment methods
    "payment.cod": { en: "Cash on Delivery", bn: "পরিবহনে নগদ পেমেন্ট" },
    "payment.bkash": { en: "bKash", bn: "বিকাশ" },
    "payment.nagad": { en: "Nagad", bn: "নগদ" },
    "payment.rocket": { en: "Rocket", bn: "রকেট" },
    "payment.sslcommerz": { en: "Card / Online Banking", bn: "কার্ড / অনলাইন ব্যাংকিং" },

    // Footer
    "footer.shop": { en: "Shop", bn: "দেখুন" },
    "footer.support": { en: "Support", bn: "সমর্থন" },
    "footer.legal": { en: "Legal", bn: "আইনি" },
    "footer.about": { en: "About Us", bn: "আমাদের সম্পর্কে" },
    "footer.contact": { en: "Contact", bn: "যোগাযোগ" },
    "footer.privacy": { en: "Privacy Policy", bn: "গোপনীয়তা নীতি" },
    "footer.terms": { en: "Terms of Service", bn: "সেবা শর্তাবলী" },

    // Common
    "common.loading": { en: "Loading...", bn: "লোড হচ্ছে..." },
    "common.error": { en: "Error", bn: "ত্রুটি" },
    "common.success": { en: "Success", bn: "সফল" },
    "common.cancel": { en: "Cancel", bn: "বাতিল" },
    "common.confirm": { en: "Confirm", bn: "নিশ্চিত করুন" },
    "common.close": { en: "Close", bn: "বন্ধ করুন" },
    "common.back": { en: "Back", bn: "পিছনে" },
    "common.next": { en: "Next", bn: "পরবর্তী" },
    "common.save": { en: "Save", bn: "সংরক্ষণ করুন" },
    "common.delete": { en: "Delete", bn: "অপসারণ" },
    "common.edit": { en: "Edit", bn: "সম্পাদনা" },
    "common.search": { en: "Search...", bn: "অনুসন্ধান করুন..." },
    "common.no_results": { en: "No results found", bn: "কোনো ফলাফল পাওয়া গেল না" },
    "common.all": { en: "All", bn: "সব" },
    "common.filter": { en: "Filter", bn: "ফিল্টার" },
    "common.sort": { en: "Sort", bn: "সাজান" },

    // Shipping
    "shipping.free": { en: "Free Shipping", bn: "ফ্রি শিপিং" },
    "shipping.standard": { en: "Standard Shipping", bn: "স্ট্যান্ডার্ড শিপিং" },
    "shipping.express": { en: "Express Shipping", bn: "এক্সপ্রেস শিপিং" },
    "shipping.gift_wrap": { en: "Gift Wrap", bn: "গিফট র‍্যাপ" },

    // Admin
    "admin.orders": { en: "Orders", bn: "অর্ডার" },
    "admin.products": { en: "Products", bn: "পণ্য" },
    "admin.customers": { en: "Customers", bn: "গ্রাহক" },
    "admin.analytics": { en: "Analytics", bn: "বিশ্লেষণ" },
    "admin.settings": { en: "Settings", bn: "সেটিংস" },

    // Forms
    "form.name": { en: "Full Name", bn: "পূর্ণ নাম" },
    "form.email": { en: "Email", bn: "ইমেইল" },
    "form.phone": { en: "Phone", bn: "ফোন" },
    "form.address": { en: "Address", bn: "ঠিকানা" },
    "form.city": { en: "City", bn: "শহর" },
    "form.postal_code": { en: "Postal Code", bn: "পোস্টাল কোড" },
    "form.country": { en: "Country", bn: "দেশ" },

    // Language toggle
    "lang.en": { en: "EN", bn: "EN" },
    "lang.bn": { en: "বাংলা", bn: "বাংলা" },
  };

  return translations[key]?.[lang] ?? key;
}

/** Get all translations for a key as an object. */
export function getTranslations(key: string): Record<Language, string> {
  const translations: Record<string, Record<Language, string>> = {
    "nav.home": { en: "Home", bn: "হোম" },
    "nav.shop": { en: "Shop", bn: "দেখুন" },
    "nav.collections": { en: "Collections", bn: "সংগ্রহ" },
    "nav.about": { en: "About", bn: "পরিচয়" },
    "nav.search": { en: "Search", bn: "অনুসন্ধান" },
    "nav.cart": { en: "Cart", bn: "কার্ট" },
    "nav.account": { en: "Account", bn: "অ্যাকাউন্ট" },
    "cart.empty": { en: "Your bag is empty", bn: "আপনার কার্ট খালি" },
    "cart.items": { en: "items", bn: "আইটেম" },
    "cart.total": { en: "Total", bn: "মোট" },
    "cart.checkout": { en: "Checkout", bn: "চেকআউট" },
    "cart.continue": { en: "Continue Shopping", bn: "শপিং চালিয়ে যান" },
    "product.add_to_cart": { en: "Add to Cart", bn: "কার্টে যোগ করুন" },
    "product.view_details": { en: "View Details", bn: "বিস্তারিত দেখুন" },
    "product.in_stock": { en: "In Stock", bn: "স্টক আছে" },
    "product.out_of_stock": { en: "Out of Stock", bn: "স্টক নেই" },
    "product.quick_view": { en: "Quick View", bn: "দ্রুত দেখুন" },
    "checkout.shipping": { en: "Shipping", bn: "শিপিং" },
    "checkout.payment": { en: "Payment", bn: "পেমেন্ট" },
    "checkout.confirm": { en: "Confirm", bn: "নিশ্চিত করুন" },
    "checkout.place_order": { en: "Place Order", bn: " অর্ডার করুন" },
    "checkout.total": { en: "Order Total", bn: "অর্ডার মোট" },
    "payment.cod": { en: "Cash on Delivery", bn: "পরিবহনে নগদ পেমেন্ট" },
    "payment.bkash": { en: "bKash", bn: "বিকাশ" },
    "payment.nagad": { en: "Nagad", bn: "নগদ" },
    "payment.rocket": { en: "Rocket", bn: "রকেট" },
    "payment.sslcommerz": {
      en: "Card / Online Banking",
      bn: "কার্ড / অনলাইন ব্যাংকিং",
    },
    "footer.shop": { en: "Shop", bn: "দেখুন" },
    "footer.support": { en: "Support", bn: "সমর্থন" },
    "footer.legal": { en: "Legal", bn: "আইনি" },
    "footer.about": { en: "About Us", bn: "আমাদের সম্পর্কে" },
    "footer.contact": { en: "Contact", bn: "যোগাযোগ" },
    "footer.privacy": { en: "Privacy Policy", bn: "গোপনীয়তা নীতি" },
    "footer.terms": { en: "Terms of Service", bn: "সেবা শর্তাবলী" },
    "common.loading": { en: "Loading...", bn: "লোড হচ্ছে..." },
    "common.error": { en: "Error", bn: "ত্রুটি" },
    "common.success": { en: "Success", bn: "সফল" },
    "common.cancel": { en: "Cancel", bn: "বাতিল" },
    "common.confirm": { en: "Confirm", bn: "নিশ্চিত করুন" },
    "common.close": { en: "Close", bn: "বন্ধ করুন" },
    "common.back": { en: "Back", bn: "পিছনে" },
    "common.next": { en: "Next", bn: "পরবর্তী" },
    "common.save": { en: "Save", bn: "সংরক্ষণ করুন" },
    "common.delete": { en: "Delete", bn: "অপসারণ" },
    "common.edit": { en: "Edit", bn: "সম্পাদনা" },
    "common.search": { en: "Search...", bn: "অনুসন্ধান করুন..." },
    "common.no_results": { en: "No results found", bn: "কোনো ফলাফল পাওয়া গেল না" },
    "common.all": { en: "All", bn: "সব" },
    "common.filter": { en: "Filter", bn: "ফিল্টার" },
    "common.sort": { en: "Sort", bn: "সাজান" },
    "shipping.free": { en: "Free Shipping", bn: "ফ্রি শিপিং" },
    "shipping.standard": { en: "Standard Shipping", bn: "স্ট্যান্ডার্ড শিপিং" },
    "shipping.express": { en: "Express Shipping", bn: "এক্সপ্রেস শিপিং" },
    "shipping.gift_wrap": { en: "Gift Wrap", bn: "গিফট র‍্যাপ" },
    "admin.orders": { en: "Orders", bn: "অর্ডার" },
    "admin.products": { en: "Products", bn: "পণ্য" },
    "admin.customers": { en: "Customers", bn: "গ্রাহক" },
    "admin.analytics": { en: "Analytics", bn: "বিশ্লেষণ" },
    "admin.settings": { en: "Settings", bn: "সেটিংস" },
    "form.name": { en: "Full Name", bn: "পূর্ণ নাম" },
    "form.email": { en: "Email", bn: "ইমেইল" },
    "form.phone": { en: "Phone", bn: "ফোন" },
    "form.address": { en: "Address", bn: "ঠিকানা" },
    "form.city": { en: "City", bn: "শহর" },
    "form.postal_code": { en: "Postal Code", bn: "পোস্টাল কোড" },
    "form.country": { en: "Country", bn: "দেশ" },
    "lang.en": { en: "EN", bn: "EN" },
    "lang.bn": { en: "বাংলা", bn: "বাংলা" },
  };

  return translations[key] ?? { en: key, bn: key };
}
