"use client";

import { Check, ChevronDown, Loader2, Lock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ASSIGNABLE_ROLES, ROLE_HINT, ROLE_LABEL } from "@/lib/rbac";
import type { SessionRole } from "@/types";

/** One palette for the five roles, shared by the badge and the picker. */
export const ROLE_TONE: Readonly<Record<SessionRole, string>> = {
  SUPER_ADMIN: "border-primary/35 bg-primary/12 text-primary",
  INVENTORY_MANAGER: "border-blue-500/30 bg-blue-500/12 text-blue-300",
  SEO_MANAGER: "border-violet-500/30 bg-violet-500/12 text-violet-300",
  SUPPORT_MANAGER: "border-emerald-500/30 bg-emerald-500/12 text-emerald-300",
  CUSTOMER: "border-[#333] bg-white/5 text-muted-foreground",
};

/** Read-only role pill — the fallback everywhere the picker is hidden. */
export function RoleBadge({ role, className }: { role: SessionRole; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        ROLE_TONE[role],
        className,
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

interface UserRoleSelectProps {
  /** The account's current role. */
  value: SessionRole;
  /** Called with the newly picked role (the parent runs the Server Action). */
  onChange: (role: SessionRole) => void;
  /** True while the caller's action is in flight. */
  pending?: boolean;
  /**
   * Blocks the picker for safety — used for the signed-in super admin's own row
   * and for the last remaining super admin.
   */
  lockedReason?: string;
  /** Used by screen readers so every row's picker is distinguishable. */
  label: string;
}

/**
 * The role picker on **Staff & Roles**.
 *
 * A shadcn `DropdownMenu` radio group (the console has no `Select` primitive) so
 * the current role is visible in the trigger and the choice is announced as a
 * radio group. It only *asks* for a change — `updateUserRoleAction` re-checks
 * the caller is a super admin, refuses self-changes and protects the last super
 * admin, so hiding or unlocking this control can never grant access.
 */
export function UserRoleSelect({
  value,
  onChange,
  pending = false,
  lockedReason,
  label,
}: UserRoleSelectProps) {
  const locked = Boolean(lockedReason);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={locked || pending}
        aria-label={`${label}: change role`}
        title={lockedReason ?? `Change ${label}'s role`}
        className={cn(
          "inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none",
          ROLE_TONE[value],
          locked
            ? "cursor-not-allowed opacity-70"
            : "hover:border-[#3A3A3A] hover:brightness-125 disabled:opacity-50",
        )}
      >
        {pending && <Loader2 aria-hidden className="size-3 animate-spin" />}
        {locked && <Lock aria-hidden className="size-3" />}
        {ROLE_LABEL[value]}
        {!locked && !pending && <ChevronDown aria-hidden className="size-3 opacity-70" />}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-64 border-[#242424] bg-[#141414] text-foreground"
      >
        <DropdownMenuLabel className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Console role
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[#242424]" />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            if (next !== value) onChange(next as SessionRole);
          }}
        >
          {ASSIGNABLE_ROLES.map((role) => (
            <DropdownMenuRadioItem
              key={role}
              value={role}
              className="items-start gap-2 text-xs focus:bg-white/5"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-foreground">{ROLE_LABEL[role]}</span>
                <span className="text-[11px] text-muted-foreground">{ROLE_HINT[role]}</span>
              </span>
              {role === value && <Check aria-hidden className="ml-auto size-3.5 text-primary" />}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="bg-[#242424]" />
        <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
          Only a super admin can change roles, and a change reaches the user on their
          next sign-in.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
