"use client";

import { createContext, useContext, useMemo } from "react";
import { hasPermission, type AdminPermission } from "@/lib/rbac";
import type { AdminUser } from "@/types";

interface AdminSessionValue {
  /** The signed-in operator, straight from the Auth.js session. */
  user: AdminUser;
  /** `can("products:write")` — the same matrix the Server Actions enforce. */
  can: (permission: AdminPermission) => boolean;
}

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

/**
 * Carries the server-resolved session down to the console's client components.
 *
 * The value comes from `app/admin/layout.tsx`, which runs `requireAdminSection`
 * — so the role is already known during the server render (no `useSession()`
 * flash) and every client guard reads the exact same matrix the Server Actions
 * enforce in `app/admin/actions.ts`.
 */
export function AdminSessionProvider({
  user,
  children,
}: {
  user: AdminUser;
  children: React.ReactNode;
}) {
  const value = useMemo<AdminSessionValue>(
    () => ({
      user,
      can: (permission: AdminPermission) => hasPermission(user.role, permission),
    }),
    [user],
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

/** The console session. Throws when used outside `/admin`. */
export function useAdminSession(): AdminSessionValue {
  const value = useContext(AdminSessionContext);
  if (!value) {
    throw new Error("useAdminSession must be used inside the /admin layout");
  }
  return value;
}
