import { requireAdminSection } from "@/lib/auth";

/**
 * RBAC gate for Analytics — open to super admins only.
 *
 * `middleware.ts` already blocks the route at the edge; this layout re-checks on
 * the server so the page can never render for a role that is not allowed to see
 * it, and redirects to `/unauthorized` carrying the blocked path so the operator
 * is told which section they were sent away from.
 */
export default async function AdminAnalyticsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdminSection("analytics");

  return <>{children}</>;
}
