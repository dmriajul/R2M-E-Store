import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminDataHydrator } from "@/components/admin/AdminDataHydrator";
import { getAdminProducts } from "@/lib/data/admin-products";
import { getAdminOrders } from "@/lib/data/admin-orders";
import { getAdminCategories } from "@/lib/data/categories";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Mukra" },
  description: "LUXE operations console — products, orders and inventory.",
  robots: { index: false, follow: false },
};

/**
 * The console reads live records on every request, so the whole `/admin`
 * segment renders dynamically (never a build-time snapshot of the catalogue).
 */
export const dynamic = "force-dynamic";

/**
 * Console layout. It sits outside the `(shop)` route group on purpose: the admin
 * area has its own shell rather than the storefront Navbar/Footer.
 *
 * The three collections the console mutates are loaded here — from Postgres
 * when `DATABASE_URL` is set, or `null` in demo mode, in which case the client
 * store keeps its in-session dataset. Load failures also resolve to `null`
 * (logged, not thrown) so a schema problem can't white-screen the console.
 */
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [products, orders, categories] = await Promise.all([
    getAdminProducts().catch((error: unknown) => {
      console.error("[admin] Could not load products", error);
      return null;
    }),
    getAdminOrders(),
    getAdminCategories(),
  ]);

  return (
    <AdminDataHydrator products={products} orders={orders} categories={categories}>
      <AdminShell>{children}</AdminShell>
    </AdminDataHydrator>
  );
}
