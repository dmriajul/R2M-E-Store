import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { authConfig } from "@/lib/auth.config";
import { verifyCredentialsDetailed, type CredentialFailure } from "@/lib/data/users";
import { loginSchema } from "@/lib/validations";
import {
  canAccessSection,
  normalizeRole,
  pathForSection,
  type AdminSection,
} from "@/lib/rbac";
import type { AdminRole, AdminUser, SessionRole } from "@/types";

/**
 * Auth.js (NextAuth v5) instance.
 *
 * Credentials + bcrypt against Postgres when `DATABASE_URL` exists, and the
 * demo accounts (`admin@littleluxe.com / admin123`, `sarah@example.com /
 * password123`, or any email with `password123`) when it does not — so the
 * login form behaves identically in both modes.
 *
 * The JWT carries `role`, normalised through `normalizeRole()` so a legacy
 * `ADMIN` row reads as `SUPER_ADMIN` everywhere downstream.
 */
class LoginError extends CredentialsSignin {
  constructor(reason: CredentialFailure) {
    super();
    this.code = reason;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse({
          email: raw?.email,
          password: raw?.password,
          remember: true,
        });
        if (!parsed.success) throw new LoginError("wrong-password");

        const { user, failure } = await verifyCredentialsDetailed(
          parsed.data.email,
          parsed.data.password,
        );
        if (!user) throw new LoginError(failure ?? "wrong-password");

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: normalizeRole(user.role),
          image: user.avatar ?? null,
        };
      },
    }),
  ],
});

/** Convenience helpers used by API routes and server components. */
export async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * True when the signed-in user is an operator of any console role.
 * (Every console role is a form of administrator; the *section* a role may
 * reach is decided by `canAccessSection()` / `hasPermission()`.)
 */
export async function isAdmin(): Promise<boolean> {
  const role = (await currentUser())?.role;
  return normalizeRole(role) !== "CUSTOMER";
}

/* -------------------------------------------------------------------------- */
/*  RBAC gates                                                                */
/* -------------------------------------------------------------------------- */

export interface RoleGateSuccess {
  ok: true;
  user: AdminUser;
}

export interface RoleGateFailure {
  ok: false;
  /** No session at all (`unauthenticated`), or a session whose role is too low. */
  reason: "unauthenticated" | "forbidden";
  /** Safe to show in the console (toast) verbatim. */
  message: string;
}

export type RoleGateResult = RoleGateSuccess | RoleGateFailure;

/** Minimal shape of the Auth.js session this module needs (keeps tests cheap). */
export interface SessionLike {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
}

/**
 * Pure gate: does `session` satisfy `allowedRoles`?
 *
 * Used by Server Actions and API routes (via `requireActionRole`), by the
 * console layouts (`requireAdminSection`) and by the middleware — one predicate,
 * every enforcement point.
 */
export function requireRole(
  session: SessionLike | null | undefined,
  allowedRoles: readonly AdminRole[],
): RoleGateResult {
  const user = session?.user;
  const role = normalizeRole(user?.role);

  if (!user) {
    return {
      ok: false,
      reason: "unauthenticated",
      message: "Administrator access required. Sign in with a staff account.",
    };
  }

  if (role === "CUSTOMER") {
    // Signed in, but a shopper: their own area is /dashboard.
    return {
      ok: false,
      reason: "forbidden",
      message: "Your account doesn't have access to the operations console.",
    };
  }

  if (!allowedRoles.includes(role)) {
    return {
      ok: false,
      reason: "forbidden",
      message: `Your role (${role.replace(/_/g, " ").toLowerCase()}) can't perform this action.`,
    };
  }

  return {
    ok: true,
    user: {
      id: user.id ?? "",
      name: user.name?.trim() || user.email?.split("@")[0] || "Operator",
      email: user.email ?? "",
      role,
    },
  };
}

/** Resolves the current session and applies `requireRole` to it. */
export async function requireActionRole(
  allowedRoles: readonly AdminRole[],
): Promise<RoleGateResult> {
  return requireRole(await auth(), allowedRoles);
}

/** The console roles, whatever shape the caller's role list has. */
export async function requireAdminSession(): Promise<AdminUser | null> {
  const gate = requireRole(await auth(), ADMIN_SESSION_ROLES);
  return gate.ok ? gate.user : null;
}

/**
 * Every console role — used by the `/admin` shell itself, which all four may
 * open (the per-section layouts narrow it further).
 */
const ADMIN_SESSION_ROLES: readonly AdminRole[] = [
  "SUPER_ADMIN",
  "INVENTORY_MANAGER",
  "SEO_MANAGER",
  "SUPPORT_MANAGER",
];

/**
 * Page/layout guard: resolves the session, redirects anyone who is not signed
 * in to `/login`, and anyone whose role may not open `section` to
 * `/unauthorized`. Returns the operator for the console UI.
 */
export async function requireAdminSection(section: AdminSection): Promise<AdminUser> {
  const session = await auth();
  const user = session?.user;
  const role = normalizeRole(user?.role);

  if (!user || role === "CUSTOMER") {
    // Customers have their own area; everyone else signs in first.
    const destination = user ? "/unauthorized" : "/login?callbackUrl=%2Fadmin";
    redirect(destination);
  }

  if (!canAccessSection(role, section)) {
    redirect(`/unauthorized?from=${encodeURIComponent(pathForSection(section))}`);
  }

  return {
    id: user.id,
    name: user.name?.trim() || user.email?.split("@")[0] || "Operator",
    email: user.email ?? "",
    role,
  };
}

/** The session role as a string union, for client components. */
export type { SessionRole };
