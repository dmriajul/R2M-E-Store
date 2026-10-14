/**
 * Role-based access control.
 *
 * Pure data + predicates — **no Prisma, no Next.js, no React** — so the same
 * matrix is read by `middleware.ts` (edge), the Server Actions, the console
 * layouts and the client components that hide affordances. One definition, four
 * enforcement points; nothing here can drift out of sync.
 *
 * The four console roles:
 *
 * | Role | Can reach |
 * | --- | --- |
 * | `SUPER_ADMIN` | everything |
 * | `INVENTORY_MANAGER` | dashboard, products, categories (incl. low stock) |
 * | `SEO_MANAGER` | dashboard, products (metadata only), settings |
 * | `SUPPORT_MANAGER` | dashboard, orders, returns, customers |
 *
 * The legacy two-role build shipped a single `ADMIN`; `normalizeRole()` maps it
 * to `SUPER_ADMIN` so an un-migrated database keeps full access.
 */

import type { AdminRole, AuthRole, SessionRole } from "@/types";

/** Every console role, most privileged first. */
export const ADMIN_ROLES: readonly AdminRole[] = [
  "SUPER_ADMIN",
  "INVENTORY_MANAGER",
  "SEO_MANAGER",
  "SUPPORT_MANAGER",
];

export const ADMIN_ROLE_LABEL: Readonly<Record<AdminRole, string>> = {
  SUPER_ADMIN: "Super Admin",
  INVENTORY_MANAGER: "Inventory Manager",
  SEO_MANAGER: "SEO Manager",
  SUPPORT_MANAGER: "Support Manager",
};

/** Short blurb shown in the profile menu / console header. */
export const ADMIN_ROLE_HINT: Readonly<Record<AdminRole, string>> = {
  SUPER_ADMIN: "Full access to every console section",
  INVENTORY_MANAGER: "Products, categories and stock",
  SEO_MANAGER: "Product metadata, banners and SEO",
  SUPPORT_MANAGER: "Orders, returns and customers",
};

/** True for the four console roles (never `CUSTOMER`). */
export function isAdminRole(role: unknown): role is AdminRole {
  return typeof role === "string" && (ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Maps any stored role onto the vocabulary the session and console use.
 * Anything unrecognised (including `CUSTOMER`) resolves to `CUSTOMER` — the
 * safe default: no console access.
 */
export function normalizeRole(role: AuthRole | string | null | undefined): SessionRole {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "SUPER_ADMIN";
  return isAdminRole(role) ? role : "CUSTOMER";
}

/** True when `role` (any shape) resolves to a console role. */
export function isStaff(role: AuthRole | string | null | undefined): boolean {
  return normalizeRole(role) !== "CUSTOMER";
}

/* -------------------------------------------------------------------------- */
/*  Permissions                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Everything that can be done in the console. Routes are guarded by the
 * section they belong to; Server Actions and API routes ask for the permission
 * they actually need.
 */
export type AdminPermission =
  | "products:read"
  | "products:write"
  | "products:seo"
  | "orders:read"
  | "orders:write"
  | "returns:read"
  | "returns:write"
  | "customers:read"
  | "coupons:write"
  | "categories:write"
  | "settings:write"
  | "analytics:read"
  /** Staff & Roles: listing accounts and moving them between roles. */
  | "users:manage";

/** The single source of truth: which roles may exercise each permission. */
export const PERMISSION_ROLES: Readonly<Record<AdminPermission, readonly AdminRole[]>> = {
  "products:read": ["SUPER_ADMIN", "INVENTORY_MANAGER", "SEO_MANAGER"],
  "products:write": ["SUPER_ADMIN", "INVENTORY_MANAGER"],
  /** Product metadata / display placement — the SEO manager's write surface. */
  "products:seo": ["SUPER_ADMIN", "SEO_MANAGER"],
  "orders:read": ["SUPER_ADMIN", "SUPPORT_MANAGER"],
  "orders:write": ["SUPER_ADMIN", "SUPPORT_MANAGER"],
  "returns:read": ["SUPER_ADMIN", "SUPPORT_MANAGER"],
  "returns:write": ["SUPER_ADMIN", "SUPPORT_MANAGER"],
  "customers:read": ["SUPER_ADMIN", "SUPPORT_MANAGER"],
  "coupons:write": ["SUPER_ADMIN"],
  "categories:write": ["SUPER_ADMIN", "INVENTORY_MANAGER"],
  "settings:write": ["SUPER_ADMIN", "SEO_MANAGER"],
  "analytics:read": ["SUPER_ADMIN"],
  /** Role management is super-admin only — no manager can grant roles. */
  "users:manage": ["SUPER_ADMIN"],
};

/** Roles allowed to exercise `permission`. */
export function rolesForPermission(permission: AdminPermission): readonly AdminRole[] {
  return PERMISSION_ROLES[permission];
}

/** Does this (already normalised) role hold `permission`? */
export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return PERMISSION_ROLES[permission].includes(role);
}

/** Does this (already normalised) role hold **any** of `permissions`? */
export function hasAnyPermission(
  role: AdminRole,
  permissions: readonly AdminPermission[],
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/** Does a raw role (session/DB value) hold `permissions`? */
export function can(
  role: AuthRole | string | null | undefined,
  permission: AdminPermission,
): boolean {
  const normalized = normalizeRole(role);
  return normalized !== "CUSTOMER" && hasPermission(normalized, permission);
}

/* -------------------------------------------------------------------------- */
/*  Console sections (routes)                                                 */
/* -------------------------------------------------------------------------- */

export type AdminSection =
  | "dashboard"
  | "products"
  | "orders"
  | "returns"
  | "customers"
  | "coupons"
  | "categories"
  | "settings"
  | "analytics"
  | "staff";

/**
 * Route guards. The dashboard belongs to every console role (it is the home the
 * role-specific navigation lands on); the other sections mirror the
 * permissions above.
 */
export const SECTION_ROLES: Readonly<Record<AdminSection, readonly AdminRole[]>> = {
  dashboard: ADMIN_ROLES,
  products: PERMISSION_ROLES["products:read"],
  orders: PERMISSION_ROLES["orders:read"],
  returns: PERMISSION_ROLES["returns:read"],
  customers: PERMISSION_ROLES["customers:read"],
  coupons: PERMISSION_ROLES["coupons:write"],
  categories: PERMISSION_ROLES["categories:write"],
  settings: PERMISSION_ROLES["settings:write"],
  analytics: PERMISSION_ROLES["analytics:read"],
  staff: PERMISSION_ROLES["users:manage"],
};

const SECTION_PATHS: Readonly<Record<Exclude<AdminSection, "dashboard">, string>> = {
  products: "/admin/products",
  orders: "/admin/orders",
  returns: "/admin/returns",
  customers: "/admin/customers",
  coupons: "/admin/coupons",
  categories: "/admin/categories",
  settings: "/admin/settings",
  analytics: "/admin/analytics",
  staff: "/admin/staff",
};

/** `"/admin/products"` → `"products"`. Unknown/`/admin` paths → the dashboard. */
export function sectionForPath(pathname: string): AdminSection {
  const match = (Object.entries(SECTION_PATHS) as Array<[AdminSection, string]>).find(
    ([, path]) => pathname === path || pathname.startsWith(`${path}/`),
  );
  return match ? match[0] : "dashboard";
}

/** Where a section lives, for building "you were heading here" redirects. */
export function pathForSection(section: AdminSection): string {
  return section === "dashboard" ? "/admin" : SECTION_PATHS[section];
}

/** Does this (already normalised) role get into `section`? */
export function canAccessSection(role: AdminRole, section: AdminSection): boolean {
  return SECTION_ROLES[section].includes(role);
}

/** Where a role should land after sign-in / a blocked route. */
export function landingPathFor(role: AdminRole): string {
  if (canAccessSection(role, "orders")) return "/admin/orders";
  if (canAccessSection(role, "products")) return "/admin/products";
  if (canAccessSection(role, "settings")) return "/admin/settings";
  if (canAccessSection(role, "analytics")) return "/admin/analytics";
  return "/admin";
}

/** Where the console's global search should send an operator. */
export function searchDestinationFor(role: AdminRole): string {
  if (canAccessSection(role, "products")) return "/admin/products";
  if (canAccessSection(role, "orders")) return "/admin/orders";
  return "/admin";
}

/** Sections this role may open, in console order. */
export function sectionsForRole(role: AdminRole): AdminSection[] {
  return (Object.keys(SECTION_ROLES) as AdminSection[]).filter((section) =>
    canAccessSection(role, section),
  );
}

/* -------------------------------------------------------------------------- */
/*  Roles, as the Staff & Roles console shows them                             */
/* -------------------------------------------------------------------------- */

/**
 * The five roles an operator can assign, most privileged first.
 * `ADMIN` is deliberately absent: it is a legacy value that is read as
 * `SUPER_ADMIN`, never written back.
 */
export const ASSIGNABLE_ROLES = [
  "SUPER_ADMIN",
  "INVENTORY_MANAGER",
  "SEO_MANAGER",
  "SUPPORT_MANAGER",
  "CUSTOMER",
] as const satisfies readonly SessionRole[];

/** Display name for every role, shopper included. */
export const ROLE_LABEL: Readonly<Record<SessionRole, string>> = {
  CUSTOMER: "Customer",
  ...ADMIN_ROLE_LABEL,
};

/** One-line reminder of what each role can reach (used in the role picker). */
export const ROLE_HINT: Readonly<Record<SessionRole, string>> = {
  CUSTOMER: "Storefront only — no console access",
  ...ADMIN_ROLE_HINT,
};

/** Narrowing helper for values coming from forms/JSON. */
export function isAssignableRole(role: unknown): role is SessionRole {
  return typeof role === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

/* -------------------------------------------------------------------------- */
/*  Role-change policy (Staff & Roles)                                        */
/* -------------------------------------------------------------------------- */

/** The three facts the policy needs about an account. */
export interface RoleChangeSubject {
  id: string;
  email: string;
  role: SessionRole;
}

export type RoleChangeVerdict =
  | { ok: true }
  | { ok: false; reason: "unknown-account" | "self" | "last-super-admin"; error: string };

/**
 * Can `actorId`/`actorEmail` move the account `targetId` to `newRole`?
 *
 * Three rules, in one testable place:
 *
 * 1. the target must exist in the list the actor is looking at;
 * 2. nobody may change **their own** role — matched by id *and* email, so the
 *    guard holds even if a demo id and a session id ever disagree;
 * 3. the **last** super admin may not be demoted, so the console can never be
 *    left without an owner.
 *
 * Rule 3 is defence in depth: while only `SUPER_ADMIN` holds `users:manage` the
 * caller is himself a super admin, so a demotable "last" super admin can only
 * appear in a stale list (the caller's own row missing) or if the permission is
 * ever widened to another role.
 */
export function checkRoleChange(params: {
  accounts: readonly RoleChangeSubject[];
  actorId: string;
  actorEmail: string;
  targetId: string;
  newRole: SessionRole;
}): RoleChangeVerdict {
  const { accounts, actorId, actorEmail, targetId, newRole } = params;

  const target = accounts.find((account) => account.id === targetId);
  if (!target) {
    return {
      ok: false,
      reason: "unknown-account",
      error: "That account no longer exists — reload the console",
    };
  }

  const email = actorEmail.trim().toLowerCase();
  if (target.id === actorId || (email.length > 0 && target.email.trim().toLowerCase() === email)) {
    return {
      ok: false,
      reason: "self",
      error: "You can't change your own role — ask another super admin to do it.",
    };
  }

  if (target.role === "SUPER_ADMIN" && newRole !== "SUPER_ADMIN") {
    const superAdmins = accounts.filter((account) => account.role === "SUPER_ADMIN").length;
    if (superAdmins <= 1) {
      return {
        ok: false,
        reason: "last-super-admin",
        error: "At least one super admin must remain. Promote another account first.",
      };
    }
  }

  return { ok: true };
}
