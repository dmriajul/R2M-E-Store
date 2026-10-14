import { SECTION_ROLES, type AdminSection } from "@/lib/rbac";
import type { AdminRole } from "@/types";
import {
  FolderTree,
  LayoutDashboard,
  LineChart,
  Package,
  RotateCcw,
  Settings,
  ShoppingCart,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Emoji shown in the collapsed rail so sections stay readable. */
  emoji: string;
  pendingBadge?: boolean;
  /** Console section this link opens — its roles come from `lib/rbac.ts`. */
  section: AdminSection;
}

export interface AdminNavSection {
  label: string;
  items: readonly AdminNavItem[];
}

/** Sidebar map — the single source of truth for admin navigation. */
export const ADMIN_NAV: readonly AdminNavSection[] = [
  {
    label: "Main",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, emoji: "📊", section: "dashboard" },
      { href: "/admin/products", label: "Products", icon: Package, emoji: "📦", section: "products" },
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart, emoji: "🛒", section: "orders" },
      {
        href: "/admin/returns",
        label: "Returns",
        icon: RotateCcw,
        emoji: "↩️",
        pendingBadge: true,
        section: "returns",
      },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users, emoji: "👥", section: "customers" },
      { href: "/admin/coupons", label: "Coupons", icon: Tag, emoji: "🏷️", section: "coupons" },
      { href: "/admin/categories", label: "Categories", icon: FolderTree, emoji: "📂", section: "categories" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/settings", label: "Settings", icon: Settings, emoji: "⚙️", section: "settings" },
      { href: "/admin/analytics", label: "Analytics", icon: LineChart, emoji: "📈", section: "analytics" },
    ],
  },
] as const;

/** Roles allowed to open a nav item, straight from the RBAC matrix. */
export function navItemRoles(item: AdminNavItem): readonly AdminRole[] {
  return SECTION_ROLES[item.section];
}

/**
 * The navigation this role may actually use.
 *
 * Items the role can't open are dropped and empty sections disappear, so an
 * inventory manager never sees a Coupons link and support never sees Settings —
 * matching what `middleware.ts` and the per-section layouts enforce.
 */
export function navForRole(role: AdminRole): AdminNavSection[] {
  return ADMIN_NAV.map((section) => ({
    label: section.label,
    items: section.items.filter((item) => navItemRoles(item).includes(role)),
  })).filter((section) => section.items.length > 0);
}

/** Breadcrumb/page-title copy for each console route. */
export const ADMIN_PAGE_META: Readonly<Record<string, { title: string; subtitle: string }>> = {
  "/admin": { title: "Dashboard", subtitle: "Store performance at a glance" },
  "/admin/products": { title: "Products", subtitle: "Catalogue, stock and pricing" },
  "/admin/orders": { title: "Orders", subtitle: "Fulfilment queue and history" },
  "/admin/returns": { title: "Returns", subtitle: "Review refunds and exchanges" },
  "/admin/customers": { title: "Customers", subtitle: "Shoppers and their order history" },
  "/admin/coupons": { title: "Coupons", subtitle: "Discount codes and campaigns" },
  "/admin/categories": { title: "Categories", subtitle: "How the catalogue is grouped" },
  "/admin/settings": { title: "Settings", subtitle: "Store, homepage, shipping, payments and alerts" },
  "/admin/analytics": { title: "Analytics", subtitle: "Revenue, demand and traffic" },
};

export function adminPageMeta(pathname: string): { title: string; subtitle: string } {
  return (
    ADMIN_PAGE_META[pathname] ?? {
      title: "Dashboard",
      subtitle: "Store performance at a glance",
    }
  );
}

/** True when `href` is the active route (exact for /admin, prefix otherwise). */
export function isActiveRoute(href: string, pathname: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}
