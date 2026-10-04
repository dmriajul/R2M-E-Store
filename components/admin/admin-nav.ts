import {
  FolderTree,
  LayoutDashboard,
  LineChart,
  Package,
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
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, emoji: "📊" },
      { href: "/admin/products", label: "Products", icon: Package, emoji: "📦" },
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart, emoji: "🛒" },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users, emoji: "👥" },
      { href: "/admin/coupons", label: "Coupons", icon: Tag, emoji: "🏷️" },
      { href: "/admin/categories", label: "Categories", icon: FolderTree, emoji: "📂" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/settings", label: "Settings", icon: Settings, emoji: "⚙️" },
      { href: "/admin/analytics", label: "Analytics", icon: LineChart, emoji: "📈" },
    ],
  },
] as const;

/** Breadcrumb/page-title copy for each console route. */
export const ADMIN_PAGE_META: Readonly<Record<string, { title: string; subtitle: string }>> = {
  "/admin": { title: "Dashboard", subtitle: "Store performance at a glance" },
  "/admin/products": { title: "Products", subtitle: "Catalogue, stock and pricing" },
  "/admin/orders": { title: "Orders", subtitle: "Fulfilment queue and history" },
  "/admin/customers": { title: "Customers", subtitle: "Shoppers and their order history" },
  "/admin/coupons": { title: "Coupons", subtitle: "Discount codes and campaigns" },
  "/admin/categories": { title: "Categories", subtitle: "How the catalogue is grouped" },
  "/admin/settings": { title: "Settings", subtitle: "Store, shipping, payments and alerts" },
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
