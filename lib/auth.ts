import { createRateLimiter, clientIp } from "@/lib/rate-limit";
import { extractTurnstileToken, verifyTurnstileToken } from "@/lib/turnstile";
import { TURNSTILE_RESPONSE_FIELD } from "@/lib/turnstile-shared";
import { LOGIN_MESSAGES, type LoginFailure } from "@/lib/auth-messages";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { authConfig } from "@/lib/auth.config";
import {
  verifyCredentialsDetailed,
  getUserEmailVerificationStatus,
} from "@/lib/data/users";
import { resolveGoogleIdentity, GOOGLE_PROVIDER_ID } from "@/lib/data/google-oauth";
import { loginSchema } from "@/lib/validations";
import { canAccessSection, normalizeRole, pathForSection, type AdminSection } from "@/lib/rbac";
import type { AdminRole, AdminUser, AuthRole, SessionRole } from "@/types";

/**
 * Auth.js (NextAuth v5) instance.
 *
 * Credentials + bcrypt against the durable Prisma User table, plus Google OAuth
 * linked to the same users through the `GoogleIdentity` table. Missing
 * database/configuration never enables demo accounts or fake registration.
 *
 * The JWT carries `role`, normalised through `normalizeRole()` so a legacy
 * `ADMIN` row reads as `SUPER_ADMIN` everywhere downstream.
 *
 * Google sign-in lives here (Node runtime) — never in the Edge-safe
 * `lib/auth.config.ts`, which `middleware.ts` imports. The Google client
 * secret is read from the server environment only; it never reaches the
 * browser bundle.
 */
const loginLimiter = createRateLimiter({ max: 20, windowMs: 15 * 60 * 1000 });

/**
 * Google provider — registered only when both server-side credentials are
 * present, so a checkout without Google configured still runs Credentials
 * exactly as before. `profile()` maps Google's OIDC id_token to the stable
 * `providerAccountId` (the `sub` claim); the default would do the same, but
 * being explicit keeps the identity contract visible.
 */
const googleClientId = process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;
const googleProvider =
  googleClientId && googleClientSecret
    ? Google({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        profile(profile) {
          return {
            id: profile.sub,
            name: profile.name,
            email: profile.email,
            image: profile.picture,
          };
        },
      })
    : null;

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
    /**
     * Google sign-in: resolve (or safely create) the local Prisma identity,
     * then map the local user onto the profile user so the existing JWT/session
     * callbacks carry the real id, role and verification state.
     *
     * Rejections return a redirect to the login page with a fixed public code —
     * never raw provider/database details. Credentials and any future
     * provider pass through untouched.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider !== GOOGLE_PROVIDER_ID) return true;

      const resolution = await resolveGoogleIdentity({
        providerAccountId: account.providerAccountId,
        email: user?.email ?? "",
        emailVerified: profile?.email_verified === true,
        name: user?.name ?? null,
        image: user?.image ?? null,
      });

      if (!resolution.ok) {
        return `/login?error=${resolution.errorType}&code=${resolution.errorType}`;
      }

      const local = user as typeof user & {
        role?: AuthRole;
        phone?: string;
        emailVerified?: Date | boolean | null;
      };
      local.id = resolution.user.id;
      local.name = resolution.user.name;
      local.email = resolution.user.email;
      local.phone = resolution.user.phone;
      local.role = resolution.user.role;
      local.emailVerified = true;
      local.image = resolution.user.avatar ?? local.image;
      return true;
    },
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
        const tokenPresent = typeof captchaToken === "string" && captchaToken.trim().length > 0;
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[auth] Credentials CAPTCHA token received: ${tokenPresent}.`);
        }
        if (!await verifyTurnstileToken(captchaToken, { action: "login", remoteIp: ip, requestHeaders: request.headers })) {
          console.error(
            "[auth] Credentials Turnstile verification failed",
            JSON.stringify({
              provider: "credentials",
              action: "login",
              tokenPresent,
              hasCfTurnstileResponseField: Boolean(raw && typeof raw === "object" && TURNSTILE_RESPONSE_FIELD in raw),
            }),
          );
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
    // Registered only when Google credentials are configured (server env only).
    ...(googleProvider ? [googleProvider] : []),
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
