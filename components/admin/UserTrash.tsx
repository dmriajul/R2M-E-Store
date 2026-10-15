"use client";

import { useMemo, useState } from "react";
import { Clock, RotateCcw, ShieldAlert, Trash2, Undo2 } from "lucide-react";
import { cn, formatShortDate, formatStamp } from "@/lib/utils";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { AccountAvatar } from "@/components/admin/UserDetailSheet";
import { RoleBadge } from "@/components/admin/UserRoleSelect";
import { adminButtonGhost, adminInputClass } from "@/components/admin/Field";
import { TRASH_RETENTION_DAYS, trashDaysRemaining, trashExpiresAt } from "@/lib/rbac";
import type { AdminUserAccount } from "@/types";

interface UserTrashProps {
  /** The trashed accounts only — newest deletion first. */
  rows: readonly AdminUserAccount[];
  /** True while a restore/delete action is in flight. */
  pending?: boolean;
  onRestore: (ids: readonly string[]) => void;
  onPurge: (ids: readonly string[]) => void;
}

/**
 * How long is left before the cleanup job takes this account for good.
 *
 * The countdown is `trashDaysRemaining()` from `lib/rbac.ts` — the same function
 * the data-layer sweeper and the cron use — so the badge can only ever tell the
 * truth about when a record disappears.
 */
export function TrashCountdown({ account }: { account: AdminUserAccount }) {
  const days = trashDaysRemaining(account.deletedAt);
  const expiresAt = trashExpiresAt(account.deletedAt);

  return (
    <span className="flex flex-col gap-0.5">
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums",
          days === 0
            ? "border-rose-500/40 bg-rose-500/12 text-rose-300"
            : days <= 7
              ? "border-amber-500/35 bg-amber-500/10 text-amber-300"
              : "border-[#2A2A2A] bg-white/5 text-muted-foreground",
        )}
      >
        <Clock aria-hidden className="size-3" />
        {days === 0 ? "Purges next cleanup" : `${days} day${days === 1 ? "" : "s"} left`}
      </span>
      {expiresAt && (
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {formatShortDate(expiresAt.toISOString())}
        </span>
      )}
    </span>
  );
}

/**
 * **Staff & Roles → Trash** — the reversible half of deleting an account.
 *
 * Accounts land here from the detail sheet or the row action, keep their data
 * and their role, and lose the ability to sign in. Everything on this screen is
 * a request: the row buttons call `trashUsersAction`'s siblings
 * (`restoreUsersAction` / `purgeUsersAction`), which re-check the permission,
 * refuse a *live* account and refuse anything that still holds an order — so the
 * worst a stale tab can do is show an error toast.
 */
export function UserTrash({ rows, pending = false, onRestore, onPurge }: UserTrashProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length === 0) return [...rows];

    return rows.filter(
      (account) =>
        account.name.toLowerCase().includes(term) ||
        account.email.toLowerCase().includes(term) ||
        account.phone.toLowerCase().includes(term),
    );
  }, [rows, search]);

  /* A row that was restored (or deleted) can't stay selected. */
  const liveSelection = selected.filter((id) => visible.some((account) => account.id === id));

  const purgeLabel = (ids: readonly string[]) => {
    const names = ids
      .map((id) => rows.find((account) => account.id === id)?.name)
      .filter((name): name is string => Boolean(name));

    if (names.length === 0) return "these accounts";
    if (names.length <= 2) return names.join(" and ");
    return `${names[0]} and ${names.length - 1} others`;
  };

  const columns: readonly DataTableColumn<AdminUserAccount>[] = [
    {
      key: "account",
      label: "Account",
      sortable: true,
      sortValue: (account) => account.name,
      render: (account) => (
        <span className="flex items-center gap-2.5">
          <AccountAvatar account={account} className="opacity-70 grayscale" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium whitespace-nowrap text-foreground">
              {account.name}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">{account.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      sortValue: (account) => account.role,
      render: (account) => <RoleBadge role={account.role} />,
    },
    {
      key: "trashed",
      label: "Trashed",
      sortable: true,
      sortValue: (account) => account.deletedAt ?? "",
      render: (account) => (
        <span className="flex flex-col gap-0.5 whitespace-nowrap">
          <span className="text-muted-foreground tabular-nums">
            {account.deletedAt ? formatStamp(account.deletedAt) : "—"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {account.deletedBy ? `by ${account.deletedBy}` : "by a removed admin"}
          </span>
        </span>
      ),
    },
    {
      key: "expires",
      label: "Permanent delete",
      sortable: true,
      sortValue: (account) => account.deletedAt ?? "",
      render: (account) => <TrashCountdown account={account} />,
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      className: "w-44",
      render: (account) => (
        <span
          className="inline-flex items-center justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            disabled={pending}
            onClick={() => onRestore([account.id])}
            aria-label={`Restore ${account.name}`}
            title="Restore account"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#2A2A2A] px-2 text-[11px] font-medium text-muted-foreground transition-colors duration-200 hover:border-emerald-500/50 hover:text-emerald-300 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none disabled:opacity-40"
          >
            <Undo2 aria-hidden className="size-3.5" />
            Restore
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setSelected([account.id]);
              setConfirmPurge(true);
            }}
            aria-label={`Delete ${account.name} forever`}
            title="Delete forever"
            className="inline-flex size-8 items-center justify-center rounded-md border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-rose-500/50 hover:text-rose-300 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none disabled:opacity-40"
          >
            <Trash2 aria-hidden className="size-3.5" />
          </button>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- What the trash means ---------- */}
      <section className="flex flex-wrap items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 p-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-rose-500/35 bg-rose-500/12 text-rose-300">
          <ShieldAlert aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">
            {rows.length === 0
              ? "The trash is empty."
              : `${rows.length} account${rows.length === 1 ? "" : "s"} waiting — deleted for good ${TRASH_RETENTION_DAYS} days after they were trashed.`}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            A trashed account can&rsquo;t sign in and can&rsquo;t be given a role, but every order it
            placed stays intact. Restoring puts it straight back on the accounts list. Accounts that
            still hold orders are never deleted — they stay here until you restore them.
          </p>
        </div>
      </section>

      {/* ---------- Search + bulk actions ---------- */}
      <section className="flex flex-col gap-3 rounded-xl border border-[#242424] bg-[#141414] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label htmlFor="trash-search" className="sr-only">
              Search the trash
            </label>
            <input
              id="trash-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search trashed accounts..."
              className={adminInputClass}
            />
          </div>

          {liveSelection.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  onRestore(liveSelection);
                  setSelected([]);
                }}
                className={cn(adminButtonGhost, "min-h-9 px-3 text-xs")}
              >
                <Undo2 aria-hidden className="size-3.5" />
                Restore {liveSelection.length} selected
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmPurge(true)}
                className={cn(
                  adminButtonGhost,
                  "min-h-9 border-rose-500/40 px-3 text-xs text-rose-300 hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-200",
                )}
              >
                <Trash2 aria-hidden className="size-3.5" />
                Delete {liveSelection.length} forever
              </button>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="min-h-9 rounded-lg border border-[#2A2A2A] px-3 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
              >
                Clear
              </button>
            </div>
          ) : (
            <p className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
              <RotateCcw aria-hidden className="size-3.5" />
              {visible.length} of {rows.length} shown
            </p>
          )}
        </div>
      </section>

      <DataTable
        rows={visible}
        columns={columns}
        rowKey={(account) => account.id}
        selectable
        selected={liveSelection}
        onSelectedChange={(ids) => setSelected(ids)}
        initialSort={{ key: "trashed", direction: "desc" }}
        emptyMessage={
          rows.length === 0
            ? "Nothing in the trash — deleted accounts land here for a month."
            : "No trashed accounts match this search."
        }
      />

      <ConfirmActionDialog
        open={confirmPurge}
        onOpenChange={setConfirmPurge}
        destructive
        title={
          liveSelection.length > 1
            ? `Delete ${liveSelection.length} accounts forever?`
            : "Delete this account forever?"
        }
        description={`${purgeLabel(liveSelection)} will be removed from the trash for good. Accounts that still hold orders can't be deleted, and this can't be undone.`}
        confirmLabel="Delete forever"
        onConfirm={() => {
          onPurge(liveSelection);
          setSelected([]);
        }}
      />
    </div>
  );
}
