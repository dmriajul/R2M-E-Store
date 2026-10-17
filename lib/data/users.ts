/** Durable accounts use Prisma User + bcrypt only — there is no demo directory. */

import type { NewVerificationTokenRecord } from "@/lib/verification-tokens";
import { compare, hash } from "bcryptjs";
import { requireDatabase } from "@/lib/prisma";
import type { AuthRole, AuthUser } from "@/types";

import { isAccountLocked, recordFailedLoginAttempt, clearFailedLoginAttempts } from "@/lib/auth-attempts";
export { isAccountLocked, clearFailedLoginAttempts, resetLoginRateLimits, getFailedLoginAuditLog, MAX_LOGIN_ATTEMPTS, LOGIN_LOCKOUT_WINDOW_MS } from "@/lib/auth-attempts";
export type { FailedLoginAuditEntry } from "@/lib/auth-attempts";

export const BCRYPT_ROUNDS = 10;

export interface UserRecord extends AuthUser {
  /** bcrypt hash for persisted accounts. */
  password: string;
}

const normalise = (email: string): string => email.trim().toLowerCase();

/**
 * Looks a user up by email (no password check).
 *
 * **Trashed accounts are not found.** A row with `deletedAt` set is invisible
 * here, which is what makes the soft delete real: the account cannot sign in.
 * Its email remains reserved by @unique until the account is permanently purged.
 */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const address = normalise(email);

  return requireDatabase(async (db) => {
    const row = (await db.user.findFirst({
      where: { email: { equals: address, mode: "insensitive" }, deletedAt: null },
      select: { id: true, name: true, email: true, phone: true, password: true,
        role: true, avatar: true, emailVerified: true, deletedAt: true },
    })) as (UserRecord & { deletedAt?: Date | string | null }) | null;
    if (!row || row.deletedAt) return null;
    const { deletedAt: _deletedAt, ...user } = row;
    void _deletedAt;
    return user;
  });
}

/** Why a credentials check failed — surfaced to the login form as a code. */
export type CredentialFailure = "invalid-credentials" | "too-many-attempts";

export interface CredentialResult {
  user: AuthUser | null;
  failure: CredentialFailure | null;
}

/**
 * Credentials check used by the NextAuth credentials provider.
 *
 * The failure *reason* is returned (rather than just `null`) so the login form
 * can explain what went wrong — Auth.js forwards the code via
 * `?error=CredentialsSignin&code=…`.
 */
export async function verifyCredentialsDetailed(
  email: string,
  password: string,
  options?: { ip?: string },
): Promise<CredentialResult> {
  if (isAccountLocked(email, options?.ip)) return { user: null, failure: "too-many-attempts" };
  const user = await findUserByEmail(email);
  // Always do one bcrypt comparison, including missing/trashed/invalid-hash rows.
  // This reduces the obvious existence timing signal; DB/network latency is not constant-time.
  const validHash = Boolean(user && /^\$2[aby]\$(?:0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/.test(user.password));
  const dummyHash = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
  const matches = await compare(password, validHash && user ? user.password : dummyHash).catch(() => false);
  if (!user || !validHash || !matches) {
    const locked = recordFailedLoginAttempt(email, options?.ip);
    return { user: null, failure: locked ? "too-many-attempts" : "invalid-credentials" };
  }
  clearFailedLoginAttempts(email);
  return { user: stripPassword(user), failure: null };
}

/** Boolean-only wrapper (kept for convenience and older call sites). */
export async function verifyCredentials(email: string, password: string): Promise<AuthUser | null> {
  return (await verifyCredentialsDetailed(email, password)).user;
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role?: AuthRole;
}

/** Commits a durable account and its initial verification token atomically; never fabricates success. */
export async function createUser(
  input: CreateUserInput,
  verification?: NewVerificationTokenRecord,
): Promise<{ user: AuthUser | null; error: string | null; source: "database" }> {
  const email = normalise(input.email);
  try {
    const user = await requireDatabase(async (db) => {
      const passwordHash = await hash(input.password, BCRYPT_ROUNDS);
      return db.$transaction(async (tx) => {
        // Include trash: its unique email remains reserved. Normalize legacy mixed-case lookups too.
        const existing = await tx.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } }, select: { id: true },
        });
        if (existing) return null;
        const created = (await tx.user.create({
          data: { name: input.name, email, phone: input.phone ?? null,
            password: passwordHash, role: input.role ?? "CUSTOMER" },
        })) as UserRecord;
        if (verification) {
          await tx.verificationToken.upsert({ where: { identifier: email },
            create: { ...verification, identifier: email }, update: { ...verification, identifier: email } });
        }
        return stripPassword(created);
      });
    });
    return { user, error: user ? null : "EMAIL_ALREADY_EXISTS", source: "database" };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { user: null, error: "EMAIL_ALREADY_EXISTS", source: "database" };
    }
    throw error; // Storage, grants, schema and transaction failures become 503 at the API boundary.
  }
}

export function stripPassword(user: UserRecord): AuthUser {
  const { password: _password, ...rest } = user;
  void _password;
  return rest;
}

/** Server-derived session flag; Credentials enforces verification for new customer sessions. */
export async function getUserEmailVerificationStatus(id: string): Promise<boolean> {
  return requireDatabase(async (db) => {
    const user = (await db.user.findUnique({ where: { id },
      select: { emailVerified: true, deletedAt: true } })) as { emailVerified: Date | null; deletedAt: Date | null } | null;
    return Boolean(user && !user.deletedAt && user.emailVerified);
  });
}
