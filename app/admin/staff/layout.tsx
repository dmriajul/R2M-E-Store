import { requireAdminSection } from "@/lib/auth";

/**
 * RBAC gate for **Staff & Roles** — super admins only.
 *
 * `middleware.ts` already blocks the route at the edge; this layout re-checks on
 * the server, so the page can never render for a role that may not manage
 * accounts (and redirects to `/unauthorized` carrying the blocked path).
 */
export default async function AdminStaffLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdminSection("staff");

  return <>{children}</>;
}
