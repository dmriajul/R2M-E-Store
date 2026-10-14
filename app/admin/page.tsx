import AdminDashboard from "@/components/admin/AdminDashboard";

/**
 * Console dashboard.
 *
 * A thin server shell: `app/admin/layout.tsx` has already resolved the session
 * and rejected anyone without a console role, and the client component reads it
 * from `AdminSessionProvider` to render the panels this role may see.
 */
export default function AdminDashboardPage() {
  return <AdminDashboard />;
}
