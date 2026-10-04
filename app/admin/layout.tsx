import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Little Luxe" },
  description: "LUXE operations console — products, orders and inventory.",
  robots: { index: false, follow: false },
};

/**
 * Console layout. It sits outside the `(shop)` route group on purpose: the admin
 * area has its own shell rather than the storefront Navbar/Footer.
 */
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
