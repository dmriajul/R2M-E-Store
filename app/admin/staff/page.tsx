import type { Metadata } from "next";
import { StaffDirectory } from "@/components/admin/StaffDirectory";
import { requireAdminSection } from "@/lib/auth";
import { getAdminUserAccounts } from "@/lib/data/admin-users";
import { getDemoUserAccounts } from "@/lib/data/users";

export const metadata: Metadata = {
  title: "Staff & Roles",
  description: "Accounts and their console permissions.",
  robots: { index: false, follow: false },
};

/**
 * **Staff & Roles** — where a super admin moves an account between the five
 * roles.
 *
 * The gate is layered: the middleware refuses `/admin/staff` for every role
 * except `SUPER_ADMIN`, `app/admin/staff/layout.tsx` re-checks on the server,
 * and `updateUserRoleAction` re-checks a third time before it writes. This page
 * only assembles the list — from Postgres when `DATABASE_URL` is set, otherwise
 * from the demo accounts (whose role changes are kept in this server session).
 */
export default async function AdminStaffPage() {
  const operator = await requireAdminSection("staff");

  const fromDatabase = await getAdminUserAccounts();
  const rows = fromDatabase ?? getDemoUserAccounts();

  return (
    <StaffDirectory
      rows={rows}
      currentUserId={operator.id}
      source={fromDatabase ? "database" : "demo"}
    />
  );
}
