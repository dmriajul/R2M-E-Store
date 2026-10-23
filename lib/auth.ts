import { createRateLimiter, clientIp } from "@/lib/rate-limit";
import { extractTurnstileToken, verifyTurnstileToken } from "@/lib/turnstile";
import { TURNSTILE_RESPONSE_FIELD } from "@/lib/turnstile-shared";
import { LOGIN_MESSAGES, type LoginFailure } from "@/lib/auth-messages";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { authConfig } from "@/lib/auth.config";
import {
  verifyCredentialsDetailed,
  getUserEmailVerificationStatus,
} from "@/lib/data/users";
import { loginSchema } from "@/lib/validations";
import { canAccessSection, normalizeRole, pathForSection, type AdminSection } from "@/lib/rbac";
import type { AdminRole, AdminUser, SessionRole } from "@/types";

/**
 * Auth.js (NextAuth v5) instance.
 *
 * Credentials + bcrypt against the durable Prisma User table only.
 * Missing database/configuration never enables demo accounts or fake registration.
 *
 * The JWT carries `role`, normalised through `normalizeRole()` so a legacy
 * `ADMIN` row reads as `SUPER_ADMIN` everywhere downstream.
 */
const loginLimiter = createRateLimiter({ max: 20, windowMs: 15 * 60 * 1000 });

class LoginError extends CredentialsSignin {
  constructor(reason: LoginFailure) {
    super();
    this.code = reason;
    this.message = LOGIN_MESSAGES[reason];
    // Fixed code only: no email, password, token, IP or provider response.
    console.warn(`[auth] Sign-in rejected: ${reason}`);
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(args) {
      const token = authConfig.callbacks.jwt(args);
      if (typeof token.id === "string" && token.emailVerified !== true) {
        try {
          token.emailVerified = await getUserEmailVerificationStatus(token.id);
        } catch {
          // Refresh status for existing sessions without revoking staff/legacy sessions.
          // New customer sign-ins are checked separately after password verification.
          token.emailVerified = false;
        }
      }
      return token;
    },
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        [TURNSTILE_RESPONSE_FIELD]: { label: "Security check", type: "hidden" },
        turnstileToken: { label: "Security check", type: "hidden" },
      },
      async authorize(raw, request) {
        const ip = clientIp(request.headers);
        if (!loginLimiter.check(ip).ok)
          throw new LoginError("too-many-attempts");
        const captchaToken = extractTurnstileToken(raw, request.headers);
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[auth] Credentials CAPTCHA token received: ${typeof captchaToken === "string" && captchaToken.trim().length > 0}.`);
        }
        if (!await verifyTurnstileToken(captchaToken, { action: "login", remoteIp: ip, requestHeaders: request.headers })) {
          throw new LoginError("security-verification-failed");
        }
        const parsed = loginSchema.safeParse({
          email: raw?.email,
          password: raw?.password,
          remember: true,
        });
        if (!parsed.success) throw new LoginError("invalid-credentials");

        let result;
        try {
          result = await verifyCredentialsDetailed(parsed.data.email, parsed.data.password, { ip: clientIp(request.headers) });
        } catch {
          console.error("[auth] Credential storage unavailable");
          throw new LoginError("account-service-unavailable");
        }
        const { user, failure } = result;
        if (!user) throw new LoginError(failure ?? "invalid-credentials");
        // Existence/status is disclosed only after a successful password check.
        // Preserve established staff/admin access, including nullable legacy records.
        if (normalizeRole(user.role) === "CUSTOMER" && !user.emailVerified) {
          throw new LoginError("email-not-verified");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: normalizeRole(user.role),
          emailVerified: Boolean(user.emailVerified),
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
