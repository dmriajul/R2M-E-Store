import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardSessionProvider } from "@/components/dashboard/DashboardSessionProvider";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { auth } from "@/lib/auth";
import { DEMO_SHOPPER_EMAIL } from "@/lib/mock-dashboard";

/** The account area is private: never index it (belt-and-braces with robots.ts). */
export const metadata: Metadata = {
  title: { default: "Your Account", template: "%s · Your Account · Mukra" },
  robots: { index: false, follow: false },
};

/**
 * Account area shell.
 *
 * **Identity comes from here.** The layout resolves the Auth.js session on the
 * server and hands the real user to `DashboardSessionProvider`, which the whole
 * subtree reads — so "who am I" can never disagree with the navbar dropdown or
 * come from mock/localStorage data. The middleware already bounces signed-out
 * visitors to `/login`; the check below is the server-side second layer.
 *
 * `DEMO_SHOPPER_EMAIL` is the one account the mock orders/addresses belong to;
 * everyone else (an admin included) starts with their own empty account.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fdashboard");
  }

  const { id, name, phone, role } = session.user;
  /* Auth.js types `email` as optional; a credentialed session always has one. */
  const email = session.user.email ?? "";
  const isDemoIdentity = process.env.NODE_ENV !== "production" && email.trim().toLowerCase() === DEMO_SHOPPER_EMAIL;

  return (
    <DashboardSessionProvider
      user={{
        id,
        name: name?.trim() || email.split("@")[0] || "Shopper",
        email,
        phone: phone ?? "",
        role,
      }}
      isDemoIdentity={isDemoIdentity}
    >
      <DashboardShell>{children}</DashboardShell>
    </DashboardSessionProvider>
  );
}
