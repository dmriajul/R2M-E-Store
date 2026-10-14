import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  ADMIN_ROLE_HINT,
  ADMIN_ROLE_LABEL,
  canAccessSection,
  landingPathFor,
  normalizeRole,
  pathForSection,
  sectionsForRole,
  SECTION_ROLES,
} from "@/lib/rbac";
import { ADMIN_PAGE_META } from "@/components/admin/admin-nav";

export const metadata: Metadata = {
  title: "Access denied",
  description: "Your account does not have access to that area.",
  robots: { index: false, follow: false },
};

/** `?from=/admin/coupons` → a short human label for that path. */
function describeTarget(from: string | undefined): string | null {
  if (!from || !from.startsWith("/admin")) return null;
  return ADMIN_PAGE_META[from]?.title ?? "that section";
}

/**
 * Shown when a signed-in operator (or shopper) reaches an area their role may
 * not open. The middleware and the per-section layouts both redirect here, so
 * nobody ever sees a page they are not entitled to.
 */
export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ from }, session] = await Promise.all([searchParams, auth()]);
  const role = normalizeRole(session?.user?.role);
  const isStaff = role !== "CUSTOMER";
  const target = describeTarget(from);

  /* The sections this role can open, so the page offers a way forward. */
  const home = isStaff ? landingPathFor(role) : "/dashboard";
  const reachable = isStaff
    ? sectionsForRole(role)
        .filter((section) => section !== "dashboard" && canAccessSection(role, section))
        .map((section) => ({
          href: pathForSection(section),
          label: ADMIN_PAGE_META[pathForSection(section)]?.title ?? section,
          locked: false,
        }))
    : [];
  const blocked = (Object.keys(SECTION_ROLES) as Array<keyof typeof SECTION_ROLES>)
    .filter((section) => section !== "dashboard" && isStaff && !canAccessSection(role, section))
    .map((section) => ({
      href: pathForSection(section),
      label: ADMIN_PAGE_META[pathForSection(section)]?.title ?? section,
      locked: true,
    }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16 sm:py-24">
      <span
        aria-hidden
        className="grid size-12 place-items-center rounded-xl border border-rose-500/35 bg-rose-500/12 text-rose-400"
      >
        <ShieldAlert className="size-5" />
      </span>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Access denied
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {isStaff ? (
            <>
              <span className="text-foreground">
                {ADMIN_ROLE_LABEL[role]}
              </span>{" "}
              accounts can&rsquo;t open{" "}
              <span className="text-foreground">{target ?? "that area"}</span>.{" "}
              {ADMIN_ROLE_HINT[role]}.
            </>
          ) : (
            <>
              Your account doesn&rsquo;t have access to the operations console. If you
              believe that&rsquo;s wrong, ask a super admin to review your role.
            </>
          )}
        </p>
      </div>

      {reachable.length > 0 && (
        <section className="rounded-xl border border-[#242424] bg-[#141414] p-5">
          <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            You can open
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {reachable.map((entry) => (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  className="inline-flex min-h-9 items-center rounded-lg border border-[#2A2A2A] px-3 text-xs text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                >
                  {entry.label}
                </Link>
              </li>
            ))}
          </ul>

          {blocked.length > 0 && (
            <p className="mt-4 border-t border-[#242424] pt-3 text-[11px] text-muted-foreground">
              Restricted for your role: {blocked.map((entry) => entry.label).join(", ")}.
            </p>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href={home}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          {isStaff ? "Back to your console" : "Go to my account"}
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#2A2A2A] px-4 text-sm text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
