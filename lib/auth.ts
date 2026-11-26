import { createRateLimiter, clientIp } from "@/lib/rate-limit";
import { extractTurnstileToken, verifyTurnstileToken } from "@/lib/turnstile";
import { TURNSTILE_RESPONSE_FIELD } from "@/lib/turnstile-shared";
import { LOGIN_MESSAGES, type LoginFailure } from "@/lib/auth-messages";
import NextAuth, { CredentialsSignin } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { authConfig } from "@/lib/auth.config";
import { requireDatabase } from "@/lib/prisma";
import { verifyCredentialsDetailed } from "@/lib/data/users";
import { resolveGoogleIdentity, GOOGLE_PROVIDER_ID } from "@/lib/data/google-oauth";
import { loginSchema } from "@/lib/validations";
import { canAccessSection, normalizeRole, pathForSection, type AdminSection } from "@/lib/rbac";
import type { AdminRole, AdminUser, AuthRole, SessionRole } from "@/types";

/**
 * Interval between database status/role revalidations for non-sensitive JWT
 * session reads. Sensitive admin APIs, server actions, and protected upload
 * checks always query current database state directly via
 * `getVerifiedSessionUser()` / `requireActionRole()`.
 */
export const JWT_REVALIDATION_INTERVAL_MS = 60_000;

export interface VerifiedSessionUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: SessionRole;
  emailVerified: boolean;
}

export type RevalidateSessionUserResult =
  | { status: "active"; user: VerifiedSessionUser }
  | { status: "invalid"; reason: "missing" | "deleted" | "email-unverified" }
  | { status: "error" };

interface RevalidationUserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  deletedAt: Date | null;
  emailVerified: Date | null;
}

/**
 * Checks live user existence, soft-delete status, email-verification state,
 * and current role against the database. Fails closed (`status: "error"`) on
 * any storage outage so privileged or protected access is never granted by
 * default.
 */
export async function revalidateSessionUser(
  userId: string,
): Promise<RevalidateSessionUserResult> {
  const trimmedId = userId.trim();
  if (!trimmedId) {
    return { status: "invalid", reason: "missing" };
  }

  try {
    return await requireDatabase(async (db) => {
      const row = (await db.user.findUnique({
        where: { id: trimmedId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          deletedAt: true,
          emailVerified: true,
        },
      })) as RevalidationUserRow | null;

      if (!row) {
        return { status: "invalid", reason: "missing" } as const;
      }

      if (row.deletedAt != null) {
        return { status: "invalid", reason: "deleted" } as const;
      }

      const role = normalizeRole(row.role);
      // Preserve customer email-verification requirement while allowing
      // established staff/admin accounts (including nullable legacy rows).
      if (role === "CUSTOMER" && !row.emailVerified) {
        return { status: "invalid", reason: "email-unverified" } as const;
      }

      return {
        status: "active",
        user: {
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone ?? undefined,
          role,
          emailVerified: Boolean(row.emailVerified),
        },
      } as const;
    });
  } catch {
    console.error("[auth] Session revalidation failed due to database error");
    return { status: "error" };
  }
}

type JwtCallbackParams = Parameters<typeof authConfig.callbacks.jwt>[0];

/**
 * Revalidates a JWT session token on a short interval (`JWT_REVALIDATION_INTERVAL_MS`).
 * Returns `null` when the account has been deleted, removed, left unverified as
 * a customer, or when database verification fails closed.
 */
export async function revalidateJwtToken(
  args: JwtCallbackParams,
  options?: { now?: number },
): Promise<JWT | null> {
  const now = options?.now ?? Date.now();
  const token = await authConfig.callbacks.jwt(args);

  // Fresh sign-ins have just been verified against the database in the
  // Credentials or Google callback; record the timestamp without re-querying.
  if (args.user) {
    token.revalidatedAt = now;
    return token;
  }

  const userId =
    typeof token.id === "string" && token.id.trim()
      ? token.id
      : typeof token.sub === "string" && token.sub.trim()
        ? token.sub
        : "";
  if (!userId) {
    return null;
  }

  const lastChecked = token.revalidatedAt;
  const shouldRevalidate =
    args.trigger === "update" ||
    typeof lastChecked !== "number" ||
    !Number.isFinite(lastChecked) ||
    now < lastChecked ||
    now - lastChecked >= JWT_REVALIDATION_INTERVAL_MS;

  if (!shouldRevalidate) {
    return token;
  }

  const check = await revalidateSessionUser(userId);
  if (check.status !== "active") {
    return null;
  }

  token.id = check.user.id;
  token.sub = check.user.id;
  token.name = check.user.name;
  token.email = check.user.email;
  token.role = check.user.role;
  if (check.user.phone) {
    token.phone = check.user.phone;
  } else {
    delete token.phone;
  }
  token.emailVerified = check.user.emailVerified;
  token.revalidatedAt = now;
  return token;
}

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
      return revalidateJwtToken(args);
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
 * Resolves the active session user and verifies live account status,
 * email-verification state, and current role directly against the database.
 * Fails closed (`null`) when unauthenticated, soft-deleted, missing, or when
 * the database is unavailable.
 */
export async function getVerifiedSessionUser(
  sessionInput?: SessionLike | null,
): Promise<VerifiedSessionUser | null> {
  let session: SessionLike | null | undefined = sessionInput;
  if (session === undefined) {
    try {
      session = await auth();
    } catch {
      return null;
    }
  }
  const userId = session?.user?.id;
  if (typeof userId !== "string" || !userId.trim()) {
    return null;
  }

  const check = await revalidateSessionUser(userId);
  if (check.status !== "active") {
    return null;
  }
  return check.user;
}

/**
 * True when the signed-in user is an active operator of any console role,
 * verified against the live database record.
 */
export async function isAdmin(): Promise<boolean> {
  const verified = await getVerifiedSessionUser();
  return Boolean(verified && verified.role !== "CUSTOMER");
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

/**
 * Verifies a session's user status and current role against the database
 * before applying `requireRole`, ensuring revoked or demoted staff lose
 * privileged access immediately rather than waiting for JWT expiry/TTL.
 */
export async function requireVerifiedRole(
  session: SessionLike | null | undefined,
  allowedRoles: readonly AdminRole[],
): Promise<RoleGateResult> {
  const verified = await getVerifiedSessionUser(session ?? null);
  return requireRole(verified ? { user: verified } : null, allowedRoles);
}

/**
 * Resolves the current session, revalidates user status & role against the
 * database, and applies `requireRole` to the live record.
 */
export async function requireActionRole(
  allowedRoles: readonly AdminRole[],
): Promise<RoleGateResult> {
  let session: SessionLike | null = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  return requireVerifiedRole(session, allowedRoles);
}

/** The console roles, whatever shape the caller's role list has. */
export async function requireAdminSession(): Promise<AdminUser | null> {
  const verified = await getVerifiedSessionUser();
  const gate = requireRole(verified ? { user: verified } : null, ADMIN_SESSION_ROLES);
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
 * Page/layout guard: resolves the session and verifies live database status &
 * role, redirecting anyone who is not signed in (or whose account was deleted /
 * unavailable) to `/login`, and anyone whose live role may not open `section`
 * to `/unauthorized`. Returns the operator for the console UI.
 */
export async function requireAdminSection(section: AdminSection): Promise<AdminUser> {
  const verified = await getVerifiedSessionUser();
  if (!verified) {
    redirect("/login?callbackUrl=%2Fadmin");
  }

  const role = verified.role;
  if (role === "CUSTOMER") {
    redirect("/unauthorized");
  }

  if (!canAccessSection(role, section)) {
    redirect(`/unauthorized?from=${encodeURIComponent(pathForSection(section))}`);
  }

  return {
    id: verified.id,
    name: verified.name.trim() || verified.email.split("@")[0] || "Operator",
    email: verified.email,
    role,
  };
}

/** The session role as a string union, for client components. */
export type { SessionRole };
