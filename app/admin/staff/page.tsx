import type { Metadata } from "next";
import { StaffDirectory } from "@/components/admin/StaffDirectory";
import { requireAdminSection } from "@/lib/auth";
import { getAdminUserAccounts } from "@/lib/data/admin-users";

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
 * only assembles the list — straight from Postgres, with no fallback directory.
 */
export default async function AdminStaffPage() {
  const operator = await requireAdminSection("staff");

  const rows = await getAdminUserAccounts().catch((error: unknown) => {
    console.error("[admin/staff] Could not load accounts", error);
    return [] as Awaited<ReturnType<typeof getAdminUserAccounts>>;
  });

  return <StaffDirectory rows={rows} currentUserId={operator.id} />;
}
