"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  Check,
  Clock,
  KeyRound,
  Mail,
  Phone,
  ShieldAlert,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { cn, formatShortDate, initials } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { RoleBadge, UserRoleSelect } from "@/components/admin/UserRoleSelect";
import { adminButtonBlue, adminButtonGhost } from "@/components/admin/Field";
import {
  ROLE_HINT,
  TRASH_RETENTION_DAYS,
  isTrashed,
  trashDaysRemaining,
  trashExpiresAt,
} from "@/lib/rbac";
import type { AdminUserAccount, SessionRole } from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The account fields the avatars patch adds on top of `AdminUserAccount`.
 *
 * Reading them through this intersection keeps the sheet working in both
 * builds: a row that carries a picture renders it, a row that doesn't renders
 * the initials chip the accounts table has always used, and neither build has to
 * know about the other.
 */
type AccountWithAvatar = AdminUserAccount & { avatar?: string | null };

/**
 * The account's picture, or its initials — the same chip used by the accounts
 * table, the trashed-accounts list and this sheet, so one account looks the same
 * everywhere.
 */
export function AccountAvatar({
  account,
  size = "md",
  className,
}: {
  account: AccountWithAvatar;
  size?: "md" | "lg";
  className?: string;
}) {
  const url = account.avatar?.trim() ? account.avatar.trim() : null;

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border font-semibold",
        size === "lg" ? "size-14 text-base" : "size-9 text-[11px]",
        account.role === "CUSTOMER"
          ? "border-blue-500/30 bg-blue-500/12 text-blue-300"
          : "border-primary/35 bg-gold-soft text-primary",
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded avatars live on Cloudinary and /uploads
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        initials(account.name)
      )}
    </span>
  );
}

interface UserDetailSheetProps {
  /** The account to inspect; `null` closes the sheet. */
  account: AdminUserAccount | null;
  /** The signed-in super admin — their own row is locked (safety rule 2). */
  currentUserId: string;
  /** How many **live** super admins exist — the last one can't be trashed. */
  superAdminCount: number;
  /** True while the caller's action is in flight. */
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onRoleChange: (account: AdminUserAccount, role: SessionRole) => void;
  onTrash: (account: AdminUserAccount) => void;
  onRestore: (account: AdminUserAccount) => void;
  onPurge: (account: AdminUserAccount) => void;
}

/**
 * One account in full: identity, access, role picker and the trash controls.
 *
 * It is the detail view behind the **Details** action on *Staff & Roles*, and
 * the only place the console offers "Move to trash" — the account's own row
 * stays focused on the role. Like every other console surface it only *asks*:
 * `trashUsersAction` / `restoreUsersAction` / `purgeUsersAction` re-check the
 * permission and the policy, so a stale sheet can never delete the wrong row.
 */
export function UserDetailSheet({
  account,
  currentUserId,
  superAdminCount,
  pending = false,
  onOpenChange,
  onRoleChange,
  onTrash,
  onRestore,
  onPurge,
}: UserDetailSheetProps) {
  const [confirm, setConfirm] = useState<"trash" | "purge" | null>(null);

  /* A different account always starts with its dialogs closed. */
  useEffect(() => {
    setConfirm(null);
  }, [account?.id]);

  const trashed = account ? isTrashed(account) : false;
  const isSelf = Boolean(account) && account?.id === currentUserId;
  const isLastSuperAdmin = account?.role === "SUPER_ADMIN" && superAdminCount <= 1;

  const roleLockedReason = trashed
    ? "This account is in the trash — restore it to change its role."
    : isSelf
      ? "You can't change your own role — ask another super admin to do it."
      : isLastSuperAdmin
        ? "The last super admin can't be demoted — promote another account first."
        : undefined;

  const trashLockedReason = isSelf
    ? "You can't trash your own account — ask another super admin."
    : isLastSuperAdmin
      ? "The last super admin can't be trashed — promote another account first."
      : undefined;

  const daysLeft = account ? trashDaysRemaining(account.deletedAt) : TRASH_RETENTION_DAYS;
  const expiresAt = account ? trashExpiresAt(account.deletedAt) : null;

  return (
    <Sheet open={Boolean(account)} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full border-l border-[#242424] bg-[#141414] p-0 sm:max-w-lg"
      >
        {account && (
          <>
            <SheetHeader className="flex-row items-start justify-between gap-3 border-b border-[#242424] px-6 py-4">
              <div className="min-w-0">
                <SheetTitle className="text-sm font-semibold text-foreground">
                  {account.name}
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs text-muted-foreground">
                  {account.email}
                </SheetDescription>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close account details"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
              >
                <X aria-hidden className="size-4" />
              </button>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-5">
                {/* ---------- Identity ---------- */}
                <motion.section
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-[#242424] bg-[#101010] p-4"
                >
                  <AccountAvatar account={account} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-medium text-foreground">
                      {account.name}
                      {isSelf && (
                        <span className="rounded border border-primary/35 bg-primary/12 px-1.5 py-px text-[10px] font-semibold tracking-[0.1em] text-primary uppercase">
                          You
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Mail aria-hidden className="size-3 shrink-0" />
                      {account.email}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground tabular-nums">
                      <Phone aria-hidden className="size-3 shrink-0" />
                      {account.phone || "No phone on file"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <RoleBadge role={account.role} />
                    {trashed && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/35 bg-rose-500/12 px-2 py-0.5 text-[10px] font-semibold tracking-[0.1em] text-rose-300 uppercase">
                        <Trash2 aria-hidden className="size-3" />
                        In trash
                      </span>
                    )}
                  </div>
                </motion.section>

                {/* ---------- Role ---------- */}
                <section className="rounded-xl border border-[#242424] bg-[#101010] p-4">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    <KeyRound aria-hidden className="size-3.5" />
                    Console role
                  </h3>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {trashed ? (
                      <RoleBadge role={account.role} />
                    ) : (
                      <UserRoleSelect
                        value={account.role}
                        label={account.name}
                        pending={pending}
                        lockedReason={roleLockedReason}
                        onChange={(role) => onRoleChange(account, role)}
                      />
                    )}
                    <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground">
                      {ROLE_HINT[account.role]}
                    </p>
                  </div>

                  <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                    A new role takes effect the next time this account signs in.
                  </p>
                </section>

                {/* ---------- Account meta ---------- */}
                <section className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#242424] bg-[#101010] p-4">
                    <p className="flex items-center gap-1.5 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                      <Check aria-hidden className="size-3" />
                      Joined
                    </p>
                    <p className="mt-1.5 text-xs font-medium text-foreground tabular-nums">
                      {formatShortDate(account.joinedAt)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#242424] bg-[#101010] p-4">
                    <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                      Account id
                    </p>
                    <p className="mt-1.5 truncate font-mono text-[11px] text-foreground">
                      {account.id}
                    </p>
                  </div>
                </section>

                {/* ---------- Trash ---------- */}
                <section
                  className={cn(
                    "rounded-xl border p-4",
                    trashed
                      ? "border-rose-500/30 bg-rose-500/8"
                      : "border-[#242424] bg-[#101010]",
                  )}
                >
                  <h3
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-semibold tracking-[0.12em] uppercase",
                      trashed ? "text-rose-300" : "text-muted-foreground",
                    )}
                  >
                    {trashed ? (
                      <ShieldAlert aria-hidden className="size-3.5" />
                    ) : (
                      <Trash2 aria-hidden className="size-3.5" />
                    )}
                    {trashed ? "In the trash" : "Move to trash"}
                  </h3>

                  <AnimatePresence initial={false} mode="wait">
                    {trashed ? (
                      <motion.div
                        key="trashed"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: EASE }}
                      >
                        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                          This account can&rsquo;t sign in and can&rsquo;t be assigned a role while
                          it sits here.
                          {account.deletedBy ? ` Moved here by ${account.deletedBy}.` : ""}
                          {account.deletedAt
                            ? ` Trashed ${formatShortDate(account.deletedAt)}.`
                            : ""}
                        </p>

                        <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium",
                              daysLeft === 0
                                ? "border-rose-500/40 bg-rose-500/12 text-rose-300"
                                : "border-[#2A2A2A] bg-white/5 text-foreground",
                            )}
                          >
                            <Clock aria-hidden className="size-3" />
                            {daysLeft === 0
                              ? "Purges on the next cleanup"
                              : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                          </span>
                          {expiresAt && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock aria-hidden className="size-3" />
                              Deleted after {formatShortDate(expiresAt.toISOString())}
                            </span>
                          )}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => onRestore(account)}
                            className={cn(adminButtonBlue, "min-h-10")}
                          >
                            <Undo2 aria-hidden className="size-3.5" />
                            Restore account
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setConfirm("purge")}
                            className={cn(
                              adminButtonGhost,
                              "min-h-10 border-rose-500/40 text-rose-300 hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-200",
                            )}
                          >
                            <Trash2 aria-hidden className="size-3.5" />
                            Delete forever
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="live"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: EASE }}
                      >
                        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                          Trashing is reversible: the account keeps its history but can&rsquo;t sign
                          in, and you can restore it for {TRASH_RETENTION_DAYS} days. After that the
                          cleanup job deletes it for good — accounts that still hold orders are
                          always kept.
                        </p>

                        <button
                          type="button"
                          disabled={pending || Boolean(trashLockedReason)}
                          title={trashLockedReason}
                          onClick={() => setConfirm("trash")}
                          className={cn(
                            adminButtonGhost,
                            "mt-4 min-h-10 border-rose-500/40 text-rose-300 hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-200 disabled:border-[#2A2A2A] disabled:text-muted-foreground",
                          )}
                        >
                          <Trash2 aria-hidden className="size-3.5" />
                          Move to trash
                        </button>

                        {trashLockedReason && (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {trashLockedReason}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              </div>
            </div>

            <ConfirmActionDialog
              open={confirm === "trash"}
              onOpenChange={(open) => setConfirm(open ? "trash" : null)}
              destructive
              title={`Move ${account.name} to the trash?`}
              description={`${account.email} will be signed out and can't sign back in, but nothing is erased: restore the account any time within ${TRASH_RETENTION_DAYS} days.`}
              confirmLabel="Move to trash"
              onConfirm={() => onTrash(account)}
            />

            <ConfirmActionDialog
              open={confirm === "purge"}
              onOpenChange={(open) => setConfirm(open ? "purge" : null)}
              destructive
              title={`Delete ${account.name} forever?`}
              description={`This removes ${account.email} from the trash for good. Accounts that still hold orders can't be deleted, and this can't be undone.`}
              confirmLabel="Delete forever"
              onConfirm={() => onPurge(account)}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
