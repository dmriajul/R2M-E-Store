import { DashboardShell } from "@/components/dashboard/DashboardShell";

/**
 * Account area shell. Everything under `/dashboard` gets the sidebar (or the
 * phone tab bar), the breadcrumb trail and the animated content slot.
 *
 * Kept as a server component so the page files stay client-side; page titles
 * are declared by each page.
 */
export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>;
}
