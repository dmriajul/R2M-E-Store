"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { cn, formatShortDate, initials } from "@/lib/utils";
import { ASSIGNABLE_ROLES, ROLE_HINT, ROLE_LABEL } from "@/lib/rbac";
import { updateUserRoleAction } from "@/app/admin/actions";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { UserRoleSelect } from "@/components/admin/UserRoleSelect";
import { adminInputClass } from "@/components/admin/Field";
import type { AdminUserAccount, SessionRole } from "@/types";

type RoleFilter = "all" | "staff" | SessionRole;

/** Sort rank: most privileged first, shoppers last. */
const ROLE_RANK: Readonly<Record<SessionRole, number>> = {
  SUPER_ADMIN: 0,
  INVENTORY_MANAGER: 1,
  SEO_MANAGER: 2,
  SUPPORT_MANAGER: 3,
  CUSTOMER: 4,
};

interface StaffDirectoryProps {
  /** Every account on file — Postgres rows, or the five demo logins. */
  rows: readonly AdminUserAccount[];
  /** The signed-in super admin (their own row is locked). */
  currentUserId: string;
  /** `demo` means the change lives in this server session only. */
  source: "database" | "demo";
}

/**
 * **Staff & Roles** — the super-admin surface for moving accounts between the
 * five roles.
 *
 * The route is gated three times over (middleware, `app/admin/staff/layout.tsx`
 * and `updateUserRoleAction`); this component is the visible half. It locks the
 * signed-in super admin's own row (safety rule 2) and the last remaining super
 * admin (rule 3), and applies a confirmed change to the list immediately.
 */
export function StaffDirectory({ rows, currentUserId, source }: StaffDirectoryProps) {
  const router = useRouter();

  const [accounts, setAccounts] = useState<readonly AdminUserAccount[]>(rows);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const superAdminCount = accounts.filter((account) => account.role === "SUPER_ADMIN").length;

  const counts = useMemo(() => {
    const byRole = new Map<SessionRole, number>();
    for (const account of accounts) {
      byRole.set(account.role, (byRole.get(account.role) ?? 0) + 1);
    }
    return byRole;
  }, [accounts]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesTerm =
        term.length === 0 ||
        account.name.toLowerCase().includes(term) ||
        account.email.toLowerCase().includes(term);

      const matchesFilter =
        filter === "all"
          ? true
          : filter === "staff"
            ? account.role !== "CUSTOMER"
            : account.role === filter;

      return matchesTerm && matchesFilter;
    });
  }, [accounts, search, filter]);

  const managerCount =
    (counts.get("INVENTORY_MANAGER") ?? 0) +
    (counts.get("SEO_MANAGER") ?? 0) +
    (counts.get("SUPPORT_MANAGER") ?? 0);

  const filters: readonly { id: RoleFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: accounts.length },
    { id: "staff", label: "Staff", count: superAdminCount + managerCount },
    ...ASSIGNABLE_ROLES.map((role) => ({
      id: role as RoleFilter,
      label: ROLE_LABEL[role],
      count: counts.get(role) ?? 0,
    })),
  ];

  const handleRoleChange = async (account: AdminUserAccount, role: SessionRole) => {
    setPendingId(account.id);
    const result = await updateUserRoleAction(account.id, role);
    setPendingId(null);

    if (!result.ok) {
      toast.error("Role not changed", { description: result.error });
      return;
    }

    const updated = result.data ?? { ...account, role };
    setAccounts((current) =>
      current.map((entry) => (entry.id === updated.id ? { ...entry, role: updated.role } : entry)),
    );
    toast.success("Role updated ✅", {
      description: `${updated.name} is now ${ROLE_LABEL[updated.role]}.`,
    });
    /* Re-runs the server render, so the list and the counts come from source. */
    router.refresh();
  };

  const columns: readonly DataTableColumn<AdminUserAccount>[] = [
    {
      key: "member",
      label: "Account",
      sortable: true,
      sortValue: (account) => account.name,
      render: (account) => (
        <span className="flex items-center gap-2.5">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
              account.role === "CUSTOMER"
                ? "border-blue-500/30 bg-blue-500/12 text-blue-300"
                : "border-primary/35 bg-gold-soft text-primary",
            )}
          >
            {initials(account.name)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5 font-medium whitespace-nowrap text-foreground">
              {account.name}
              {account.id === currentUserId && (
                <span className="rounded border border-primary/35 bg-primary/12 px-1.5 py-px text-[10px] font-semibold tracking-[0.1em] text-primary uppercase">
                  You
                </span>
              )}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">{account.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (account) => (
        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
          {account.phone || "—"}
        </span>
      ),
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      sortValue: (account) => ROLE_RANK[account.role],
      render: (account) => {
        const isSelf = account.id === currentUserId;
        const isLastSuperAdmin = account.role === "SUPER_ADMIN" && superAdminCount <= 1;

        return (
          <UserRoleSelect
            value={account.role}
            label={account.name}
            pending={pendingId === account.id}
            lockedReason={
              isSelf
                ? "You can't change your own role — ask another super admin to do it."
                : isLastSuperAdmin
                  ? "The last super admin can't be demoted — promote another account first."
                  : undefined
            }
            onChange={(role) => void handleRoleChange(account, role)}
          />
        );
      },
    },
    {
      key: "access",
      label: "Access",
      className: "hidden xl:table-cell",
      render: (account) => (
        <span className="text-[11px] text-muted-foreground">{ROLE_HINT[account.role]}</span>
      ),
    },
    {
      key: "joined",
      label: "Joined",
      sortable: true,
      sortValue: (account) => account.joinedAt,
      render: (account) => (
        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
          {formatShortDate(account.joinedAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Guard rails ---------- */}
      <section className="flex flex-wrap items-start gap-3 rounded-xl border border-primary/20 bg-primary/8 p-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/35 bg-primary/12 text-primary">
          <ShieldCheck aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">
            Super-admin only — {superAdminCount} account{superAdminCount === 1 ? "" : "s"} can reach
            this page.
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Your own role is locked and the last super admin can&rsquo;t be demoted, so the console can
            never be left without an owner. A new role takes effect the next time that account signs
            in.
            {source === "demo" && (
              <>
                {" "}
                <span className="text-primary">
                  No database is connected — changes last for this server session.
                </span>
              </>
            )}
          </p>
        </div>
      </section>

      {/* ---------- Filters ---------- */}
      <section className="flex flex-col gap-3 rounded-xl border border-[#242424] bg-[#141414] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label htmlFor="staff-search" className="sr-only">
              Search accounts
            </label>
            <input
              id="staff-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email..."
              className={adminInputClass}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filters.map((entry) => {
              const active = filter === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setFilter(entry.id)}
                  aria-pressed={active}
                  className={cn(
                    "min-h-9 rounded-lg border px-3 text-xs font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none",
                    active
                      ? "border-primary/45 bg-primary/12 text-primary"
                      : "border-[#2A2A2A] text-muted-foreground hover:border-[#3A3A3A] hover:text-foreground",
                  )}
                >
                  {entry.label}
                  <span className="ml-1.5 text-muted-foreground tabular-nums">{entry.count}</span>
                </button>
              );
            })}
          </div>

          <p className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            <UserCog aria-hidden className="size-3.5" />
            {accounts.length} accounts
          </p>
        </div>
      </section>

      <DataTable
        rows={visible}
        columns={columns}
        rowKey={(account) => account.id}
        initialSort={{ key: "role", direction: "asc" }}
        emptyMessage="No accounts match this search."
      />
    </div>
  );
}
