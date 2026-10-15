"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { cn, formatShortDate } from "@/lib/utils";
import {
  ASSIGNABLE_ROLES,
  ROLE_HINT,
  ROLE_LABEL,
  TRASH_RETENTION_DAYS,
  isTrashed,
} from "@/lib/rbac";
import {
  purgeUsersAction,
  restoreUsersAction,
  trashUsersAction,
  updateUserRoleAction,
} from "@/app/admin/actions";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { UserRoleSelect } from "@/components/admin/UserRoleSelect";
import { AccountAvatar, UserDetailSheet } from "@/components/admin/UserDetailSheet";
import { UserTrash } from "@/components/admin/UserTrash";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminInputClass } from "@/components/admin/Field";
import type { AdminUserAccount, SessionRole } from "@/types";

type RoleFilter = "all" | "staff" | SessionRole;
type StaffTab = "accounts" | "trash";

/** Sort rank: most privileged first, shoppers last. */
const ROLE_RANK: Readonly<Record<SessionRole, number>> = {
  SUPER_ADMIN: 0,
  INVENTORY_MANAGER: 1,
  SEO_MANAGER: 2,
  SUPPORT_MANAGER: 3,
  CUSTOMER: 4,
};

interface StaffDirectoryProps {
  /**
   * Every account on file — Postgres rows (trashed ones included), or the five
   * demo logins. The directory splits them into the two tabs itself, so the
   * page above it stays a single read.
   */
  rows: readonly AdminUserAccount[];
  /** The signed-in super admin (their own row is locked). */
  currentUserId: string;
  /** `demo` means the change lives in this server session only. */
  source: "database" | "demo";
}

/**
 * **Staff & Roles** — the super-admin surface for moving accounts between the
 * five roles, and for moving them in and out of the trash.
 *
 * The route is gated three times over (middleware, `app/admin/staff/layout.tsx`
 * and the Server Actions); this component is the visible half. It locks the
 * signed-in super admin's own row (safety rule 2) and the last remaining super
 * admin (rule 3), and applies a confirmed change to the list immediately.
 *
 * Deleting is a *move*: `Trash2` parks an account on the second tab, where it
 * waits out the retention window (`TRASH_RETENTION_DAYS`) and can be restored —
 * only the trash offers the irreversible action, and it asks twice.
 */
export function StaffDirectory({ rows, currentUserId, source }: StaffDirectoryProps) {
  const router = useRouter();

  const [accounts, setAccounts] = useState<readonly AdminUserAccount[]>(rows);
  const [tab, setTab] = useState<StaffTab>("accounts");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  /* ---------- The two lists the tabs render ---------- */

  const live = useMemo(() => accounts.filter((account) => !isTrashed(account)), [accounts]);

  const trashed = useMemo(
    () =>
      accounts
        .filter(isTrashed)
        .slice()
        .sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt))),
    [accounts],
  );

  const detailAccount = detailId
    ? (accounts.find((account) => account.id === detailId) ?? null)
    : null;

  const superAdminCount = live.filter((account) => account.role === "SUPER_ADMIN").length;

  const counts = useMemo(() => {
    const byRole = new Map<SessionRole, number>();
    for (const account of live) {
      byRole.set(account.role, (byRole.get(account.role) ?? 0) + 1);
    }
    return byRole;
  }, [live]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return live.filter((account) => {
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
  }, [live, search, filter]);

  const managerCount =
    (counts.get("INVENTORY_MANAGER") ?? 0) +
    (counts.get("SEO_MANAGER") ?? 0) +
    (counts.get("SUPPORT_MANAGER") ?? 0);

  const filters: readonly { id: RoleFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: live.length },
    { id: "staff", label: "Staff", count: superAdminCount + managerCount },
    ...ASSIGNABLE_ROLES.map((role) => ({
      id: role as RoleFilter,
      label: ROLE_LABEL[role],
      count: counts.get(role) ?? 0,
    })),
  ];

  /* ---------- Shared list helpers ---------- */

  /**
   * Merges the rows a Server Action returned back into the list (a trashed row
   * simply moves to the other tab), leaving every row the action didn't touch
   * exactly as it was.
   */
  const applyUpdated = (updated: readonly AdminUserAccount[]) => {
    setAccounts((current) =>
      current.map((entry) => updated.find((next) => next.id === entry.id) ?? entry),
    );
  };

  /** "Tanvir Hasan" / "Tanvir Hasan and 2 more" — for toast copy. */
  const describeAccounts = (ids: readonly string[]): string => {
    const names = ids
      .map((id) => accounts.find((account) => account.id === id)?.name)
      .filter((name): name is string => Boolean(name));

    if (names.length <= 1) return names[0] ?? "The account";
    return `${names[0]} and ${names.length - 1} more`;
  };

  /* ---------- Role changes ---------- */

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

  /* ---------- Trash ---------- */

  const handleTrash = async (ids: readonly string[]) => {
    setBusy(true);
    const result = await trashUsersAction(ids);
    setBusy(false);

    if (!result.ok) {
      toast.error("Account not trashed", { description: result.error });
      return;
    }

    applyUpdated(result.data?.trashed ?? []);
    toast.success("Moved to the trash 🗑️", {
      description: `${describeAccounts(ids)} can no longer sign in. Restore from the Trash tab within ${TRASH_RETENTION_DAYS} days.`,
    });
    router.refresh();
  };

  const handleRestore = async (ids: readonly string[]) => {
    setBusy(true);
    const result = await restoreUsersAction(ids);
    setBusy(false);

    if (!result.ok) {
      toast.error("Account not restored", { description: result.error });
      return;
    }

    applyUpdated(result.data?.restored ?? []);
    toast.success("Account restored ✅", {
      description: `${describeAccounts(ids)} is back on the accounts list and can sign in again.`,
    });
    router.refresh();
  };

  const handlePurge = async (ids: readonly string[]) => {
    setBusy(true);
    const result = await purgeUsersAction(ids);
    setBusy(false);

    if (!result.ok) {
      toast.error("Account not deleted", { description: result.error });
      return;
    }

    /* The rows are gone from the database — drop them from the list as well. */
    setAccounts((current) => current.filter((entry) => !ids.includes(entry.id)));
    if (detailId && ids.includes(detailId)) setDetailId(null);

    toast.success("Deleted permanently", {
      description: `${result.data?.purged ?? ids.length} account${
        (result.data?.purged ?? ids.length) === 1 ? "" : "s"
      } removed from the trash.`,
    });
    router.refresh();
  };

  /* ---------- Table ---------- */

  const columns: readonly DataTableColumn<AdminUserAccount>[] = [
    {
      key: "member",
      label: "Account",
      sortable: true,
      sortValue: (account) => account.name,
      render: (account) => (
        <span className="flex items-center gap-2.5">
          <AccountAvatar account={account} />
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
          <span onClick={(event) => event.stopPropagation()}>
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
          </span>
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
    {
      key: "actions",
      label: "Actions",
      align: "right",
      className: "w-24",
      render: (account) => (
        <span
          className="inline-flex items-center justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setDetailId(account.id)}
            aria-label={`View ${account.name}`}
            title="View account"
            className="inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
          >
            <Eye aria-hidden className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={busy || account.id === currentUserId}
            onClick={() => void handleTrash([account.id])}
            aria-label={`Move ${account.name} to the trash`}
            title="Move to trash — recoverable for the retention window"
            className="inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-rose-500/50 hover:text-rose-300 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none disabled:opacity-35"
          >
            <Trash2 aria-hidden className="size-3.5" />
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <Tabs value={tab} onValueChange={(next) => setTab(next as StaffTab)}>
        <TabsList>
          <TabsTrigger value="accounts">
            Accounts
            <span className="tabular-nums opacity-80">{live.length}</span>
          </TabsTrigger>
          <TabsTrigger value="trash">
            <Trash2 aria-hidden className="size-3.5" />
            Trash
            <span className="tabular-nums opacity-80">{trashed.length}</span>
          </TabsTrigger>
        </TabsList>

        {/* ---------- Accounts ---------- */}
        <TabsContent value="accounts">
          {/* Guard rails */}
          <section className="flex flex-wrap items-start gap-3 rounded-xl border border-primary/20 bg-primary/8 p-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/35 bg-primary/12 text-primary">
              <ShieldCheck aria-hidden className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground">
                Super-admin only — {superAdminCount} account{superAdminCount === 1 ? "" : "s"} can
                reach this page.
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Your own role is locked and the last super admin can&rsquo;t be demoted or trashed, so
                the console can never be left without an owner. A new role takes effect the next time
                that account signs in. Deleting is a move: an account goes to the Trash for{" "}
                {TRASH_RETENTION_DAYS} days, where it can be restored, and one that still holds orders
                is never erased.
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

          {/* Filters */}
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
                      <span className="ml-1.5 text-muted-foreground tabular-nums">
                        {entry.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                <UserCog aria-hidden className="size-3.5" />
                {live.length} accounts
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
        </TabsContent>

        {/* ---------- Trash ---------- */}
        <TabsContent value="trash">
          <UserTrash
            rows={trashed}
            pending={busy}
            onRestore={(ids) => void handleRestore(ids)}
            onPurge={(ids) => void handlePurge(ids)}
          />
        </TabsContent>
      </Tabs>

      <UserDetailSheet
        account={detailAccount}
        currentUserId={currentUserId}
        superAdminCount={superAdminCount}
        pending={busy || (detailAccount ? pendingId === detailAccount.id : false)}
        onOpenChange={(open) => !open && setDetailId(null)}
        onRoleChange={(account, role) => void handleRoleChange(account, role)}
        onTrash={(account) => void handleTrash([account.id])}
        onRestore={(account) => void handleRestore([account.id])}
        onPurge={(account) => void handlePurge([account.id])}
      />
    </>
  );
}
