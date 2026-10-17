/**
 * Users — database when configured, fallback account store otherwise.
 *
 * Security guarantees:
 * 1. Passwords are verified using constant-time comparison (bcrypt compare +
 *    constant-time dummy hash check when an email is not found) to prevent
 *    timing side-channel attacks.
 * 2. Both unknown email and wrong password return the identical error code
 *    (`INVALID_CREDENTIALS`) so account existence is never revealed.
 * 3. Repeated failed attempts trigger rate-limiting / temporary account lockout
 *    (`ACCOUNT_LOCKED`) and are logged server-side only.
 */

import { compare, hash } from "bcryptjs";
import { withDatabase } from "@/lib/prisma";
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD } from "@/lib/demo-mode";
import { isTrashExpired } from "@/lib/rbac";
import {
  AUTH_ERROR_CODES,
  constantTimeCompare,
  sanitizeEmail,
  sanitizeInput,
  sanitizePhone,
  type AuthErrorCode,
} from "@/lib/validations/auth";
import type {
  AdminRoleChange,
  AdminUserAccount,
  AuthRole,
  AuthUser,
  SessionRole,
} from "@/types";

export const BCRYPT_ROUNDS = 10;

/**
 * Precomputed valid bcrypt hash (cost 10) evaluated whenever a login targets a
 * non-existent email or a plaintext seed record so response timing never reveals
 * whether an email is registered.
 */
const DUMMY_BCRYPT_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export interface UserRecord extends AuthUser {
  /** bcrypt hash in the database/registered path, or seed password. */
  password: string;
}

interface DemoAccount extends UserRecord {
  demo: true;
  /** Fixed join date so the console's "Joined" column is stable across renders. */
  joinedAt: string;
}

export interface FailedLoginAuditEntry {
  email: string;
  ip: string;
  reason: string;
  attemptCount: number;
  timestamp: string;
}

/**
 * Process-wide state stored on `globalThis` so Next.js route handlers, Server
 * Actions and server components share the same maps across bundles.
 */
const demoScope = globalThis as typeof globalThis & {
  __mukraDemoRoleOverrides?: Map<string, SessionRole>;
  /** Emails parked in the trash → when, and by which super admin. */
  __mukraDemoTrashOverrides?: Map<string, DemoTrashEntry>;
  /** Emails deleted for good while no database is connected. */
  __mukraDemoPurged?: Set<string>;
  /** Role-change audit trail per account id, newest first. */
  __mukraDemoRoleHistory?: Map<string, AdminRoleChange[]>;
  /** Accounts registered at runtime when no database is configured. */
  __mukraRegisteredUsers?: Map<string, UserRecord>;
  /** Sliding-window failed login timestamps keyed by email or IP. */
  __mukraLoginAttempts?: Map<string, number[]>;
  /** Server-side audit log of failed login attempts (never sent to client). */
  __mukraFailedLoginAuditLog?: FailedLoginAuditEntry[];
};

interface DemoTrashEntry {
  deletedAt: string;
  deletedById: string;
}

const demoRoleOverrides: Map<string, SessionRole> = (demoScope.__mukraDemoRoleOverrides ??=
  new Map<string, SessionRole>());

const demoTrashOverrides: Map<string, DemoTrashEntry> = (demoScope.__mukraDemoTrashOverrides ??=
  new Map<string, DemoTrashEntry>());

const demoPurged: Set<string> = (demoScope.__mukraDemoPurged ??= new Set<string>());

const demoRoleHistory: Map<string, AdminRoleChange[]> = (demoScope.__mukraDemoRoleHistory ??=
  new Map<string, AdminRoleChange[]>());

const registeredUsers: Map<string, UserRecord> = (demoScope.__mukraRegisteredUsers ??=
  new Map<string, UserRecord>());

const loginAttempts: Map<string, number[]> = (demoScope.__mukraLoginAttempts ??=
  new Map<string, number[]>());

const failedLoginAuditLog: FailedLoginAuditEntry[] = (demoScope.__mukraFailedLoginAuditLog ??=
  []);

const normalise = (email: string): string => sanitizeEmail(email);

/** True when sign-in may use this seeded account (not trashed, not purged). */
function isDemoAccountVisible(email: string): boolean {
  const key = normalise(email);
  return !demoPurged.has(key) && !demoTrashOverrides.has(key);
}

/** Display name behind a `deletedById`, or `undefined` for an unknown id. */
function demoAccountName(id: string): string | undefined {
  return DEMO_ACCOUNTS.find((entry) => entry.id === id)?.name;
}

/** Applies any pending role override to an account record. */
function withDemoRole(account: UserRecord): UserRecord {
  const override = demoRoleOverrides.get(normalise(account.email));
  return override ? { ...account, role: override } : account;
}

/** The trash state of one account, if it is in the trash at all. */
function demoTrashFor(email: string): DemoTrashEntry | undefined {
  return demoTrashOverrides.get(normalise(email));
}

/**
 * Seeded accounts for the 4 console roles and the seeded customer account.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: "demo-admin",
    name: "Riajul Khandokar",
    email: DEMO_ADMIN_EMAIL,
    phone: "+880 1712 345678",
    password: DEMO_PASSWORD,
    role: "SUPER_ADMIN",
    emailVerified: true,
    demo: true,
    joinedAt: "2024-11-04T09:15:00.000Z",
  },
  {
    id: "demo-inventory",
    name: "Imran Hossain",
    email: "inventory@mukra.com",
    phone: "+880 1713 220011",
    password: DEMO_PASSWORD,
    role: "INVENTORY_MANAGER",
    emailVerified: true,
    demo: true,
    joinedAt: "2025-01-12T07:40:00.000Z",
  },
  {
    id: "demo-seo",
    name: "Nusrat Jahan",
    email: "seo@mukra.com",
    phone: "+880 1714 330022",
    password: DEMO_PASSWORD,
    role: "SEO_MANAGER",
    emailVerified: true,
    demo: true,
    joinedAt: "2025-02-02T10:05:00.000Z",
  },
  {
    id: "demo-support",
    name: "Tanvir Hasan",
    email: "support@mukra.com",
    phone: "+880 1715 440033",
    password: DEMO_PASSWORD,
    role: "SUPPORT_MANAGER",
    emailVerified: true,
    demo: true,
    joinedAt: "2025-02-18T11:30:00.000Z",
  },
  {
    id: "demo-sarah",
    name: "Sarah Ahmed",
    email: "sarah@example.com",
    phone: "+880 1812 445566",
    password: DEMO_PASSWORD,
    role: "CUSTOMER",
    emailVerified: true,
    demo: true,
    joinedAt: "2025-03-09T14:20:00.000Z",
  },
] as const;

/**
 * Additional fixtures for unverified and locked account states when no database
 * is connected.
 */
const SPECIAL_STATUS_ACCOUNTS: readonly UserRecord[] = [
  {
    id: "user-unverified-mukra",
    name: "Pending Verification Shopper",
    email: "unverified@mukra.com",
    phone: "+880 1811 000001",
    password: DEMO_PASSWORD,
    role: "CUSTOMER",
    emailVerified: false,
  },
  {
    id: "user-unverified-example",
    name: "Pending Verification Shopper",
    email: "unverified@example.com",
    phone: "+880 1811 000002",
    password: DEMO_PASSWORD,
    role: "CUSTOMER",
    emailVerified: false,
  },
  {
    id: "user-locked-mukra",
    name: "Locked Shopper",
    email: "locked@mukra.com",
    phone: "+880 1811 000003",
    password: DEMO_PASSWORD,
    role: "CUSTOMER",
    emailVerified: true,
    locked: true,
  },
  {
    id: "user-locked-example",
    name: "Locked Shopper",
    email: "locked@example.com",
    phone: "+880 1811 000004",
    password: DEMO_PASSWORD,
    role: "CUSTOMER",
    emailVerified: true,
    locked: true,
  },
];

/* -------------------------------------------------------------------------- */
/*  Rate Limiting & Server-Side Failed Attempt Logging                        */
/* -------------------------------------------------------------------------- */

function pruneAttempts(key: string, now: number): number[] {
  const existing = loginAttempts.get(key) ?? [];
  const active = existing.filter((stamp) => now - stamp < LOGIN_LOCKOUT_WINDOW_MS);
  if (active.length === 0) {
    loginAttempts.delete(key);
  } else {
    loginAttempts.set(key, active);
  }
  return active;
}

/**
 * Returns true if the email (or IP) has exceeded `MAX_LOGIN_ATTEMPTS` within the
 * lockout window.
 */
export function isAccountLocked(email: string, ip?: string): boolean {
  const now = Date.now();
  const emailKey = `email:${normalise(email)}`;
  const emailHits = pruneAttempts(emailKey, now);
  if (emailHits.length >= MAX_LOGIN_ATTEMPTS) return true;

  if (ip && ip !== "anonymous") {
    const ipKey = `ip:${ip}`;
    const ipHits = pruneAttempts(ipKey, now);
    if (ipHits.length >= MAX_LOGIN_ATTEMPTS * 2) return true;
  }

  return false;
}

/**
 * Records a failed login attempt in memory and logs it server-side (never
 * exposed in client responses).
 */
function recordFailedLoginAttempt(email: string, reason: string, ip = "anonymous"): number {
  const now = Date.now();
  const normalizedEmail = normalise(email);
  const emailKey = `email:${normalizedEmail}`;
  const current = pruneAttempts(emailKey, now);
  current.push(now);
  loginAttempts.set(emailKey, current);

  if (ip && ip !== "anonymous") {
    const ipKey = `ip:${ip}`;
    const ipCurrent = pruneAttempts(ipKey, now);
    ipCurrent.push(now);
    loginAttempts.set(ipKey, ipCurrent);
  }

  const entry: FailedLoginAuditEntry = {
    email: normalizedEmail,
    ip,
    reason,
    attemptCount: current.length,
    timestamp: new Date(now).toISOString(),
  };

  failedLoginAuditLog.unshift(entry);
  if (failedLoginAuditLog.length > 200) {
    failedLoginAuditLog.length = 200;
  }

  console.warn("[auth:security] Failed login attempt:", {
    email: normalizedEmail,
    ip,
    reason,
    attemptCount: entry.attemptCount,
    timestamp: entry.timestamp,
  });

  return current.length;
}

/** Clears failed login attempts for an email after a successful sign-in. */
export function clearFailedLoginAttempts(email: string): void {
  loginAttempts.delete(`email:${normalise(email)}`);
}

/** Resets login rate-limit state (for a specific email, or all accounts). */
export function resetLoginRateLimits(email?: string): void {
  if (email) {
    loginAttempts.delete(`email:${normalise(email)}`);
    return;
  }
  loginAttempts.clear();
}

/** Returns recent server-side failed login audit entries. */
export function getFailedLoginAuditLog(): readonly FailedLoginAuditEntry[] {
  return failedLoginAuditLog;
}

/* -------------------------------------------------------------------------- */
/*  User Lookup & Constant-Time Verification                                  */
/* -------------------------------------------------------------------------- */

/**
 * Looks a user up by email (no password check).
 *
 * Trashed accounts are excluded so they cannot sign in.
 */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const address = normalise(email);
  if (!address) return null;

  const { data } = await withDatabase<UserRecord | null>(
    async (db) => {
      const row = (await db.user.findUnique({ where: { email: address } })) as
        | (AuthUser & {
            password: string;
            deletedAt?: Date | string | null;
            emailVerified?: boolean | Date | null;
          })
        | null;
      if (!row || row.deletedAt) return null;

      const { deletedAt: _deletedAt, emailVerified, ...rest } = row;
      void _deletedAt;
      return {
        ...rest,
        emailVerified: emailVerified === false ? false : true,
      };
    },
    () => {
      const registered = registeredUsers.get(address);
      if (registered && isDemoAccountVisible(address)) {
        return withDemoRole(registered);
      }

      const account = DEMO_ACCOUNTS.find((entry) => entry.email === address);
      if (account && isDemoAccountVisible(account.email)) {
        return withDemoRole(account);
      }

      const special = SPECIAL_STATUS_ACCOUNTS.find((entry) => entry.email === address);
      if (special && isDemoAccountVisible(special.email)) {
        return special;
      }

      return null;
    },
  );

  return data;
}

/**
 * Constant-time password verification against a `UserRecord`.
 */
async function verifyPasswordConstantTime(
  candidatePassword: string,
  storedPassword: string,
): Promise<boolean> {
  if (storedPassword.startsWith("$2")) {
    return compare(candidatePassword, storedPassword).catch(() => false);
  }
  // Perform a full bcrypt comparison against the dummy hash to equalize CPU time,
  // then compare the plaintext bytes in constant time.
  await compare(candidatePassword, DUMMY_BCRYPT_HASH).catch(() => false);
  return constantTimeCompare(candidatePassword, storedPassword);
}

/**
 * Error code returned when a credentials check fails.
 *
 * Security rule: Both unknown email and wrong password return
 * `INVALID_CREDENTIALS` so callers can never distinguish whether an email
 * exists in the database.
 */
export type CredentialFailure =
  | typeof AUTH_ERROR_CODES.INVALID_CREDENTIALS
  | typeof AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED
  | typeof AUTH_ERROR_CODES.ACCOUNT_LOCKED
  | typeof AUTH_ERROR_CODES.MISSING_FIELDS
  | typeof AUTH_ERROR_CODES.INVALID_EMAIL
  | typeof AUTH_ERROR_CODES.SERVER_ERROR;

export interface CredentialResult {
  user: AuthUser | null;
  failure: CredentialFailure | null;
}

/**
 * Credentials check used by NextAuth and `/api/auth/login`.
 *
 * - Enforces rate limiting / lockout (`ACCOUNT_LOCKED`)
 * - Performs constant-time password verification even when the user is not found
 * - Never reveals whether the email exists (`INVALID_CREDENTIALS` for both
 *   non-existent email and wrong password)
 * - Checks email verification (`EMAIL_NOT_VERIFIED`)
 * - Logs all failed attempts server-side
 */
export async function verifyCredentialsDetailed(
  email: string,
  password: string,
  options?: { ip?: string },
): Promise<CredentialResult> {
  const normalizedEmail = normalise(email);
  const ip = options?.ip ?? "anonymous";

  if (isAccountLocked(normalizedEmail, ip)) {
    recordFailedLoginAttempt(normalizedEmail, "account-locked-rate-limit", ip);
    return { user: null, failure: AUTH_ERROR_CODES.ACCOUNT_LOCKED };
  }

  try {
    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      // Constant-time dummy bcrypt check to prevent timing-based email enumeration.
      await compare(password, DUMMY_BCRYPT_HASH).catch(() => false);
      const attempts = recordFailedLoginAttempt(normalizedEmail, "unknown-email", ip);
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        return { user: null, failure: AUTH_ERROR_CODES.ACCOUNT_LOCKED };
      }
      return { user: null, failure: AUTH_ERROR_CODES.INVALID_CREDENTIALS };
    }

    if (user.locked) {
      await compare(password, DUMMY_BCRYPT_HASH).catch(() => false);
      recordFailedLoginAttempt(normalizedEmail, "account-flagged-locked", ip);
      return { user: null, failure: AUTH_ERROR_CODES.ACCOUNT_LOCKED };
    }

    const passwordMatches = await verifyPasswordConstantTime(password, user.password);

    if (!passwordMatches) {
      const attempts = recordFailedLoginAttempt(normalizedEmail, "wrong-password", ip);
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        return { user: null, failure: AUTH_ERROR_CODES.ACCOUNT_LOCKED };
      }
      return { user: null, failure: AUTH_ERROR_CODES.INVALID_CREDENTIALS };
    }

    if (user.emailVerified === false) {
      recordFailedLoginAttempt(normalizedEmail, "email-not-verified", ip);
      return { user: null, failure: AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED };
    }

    clearFailedLoginAttempts(normalizedEmail);
    return { user: stripPassword(user), failure: null };
  } catch (error) {
    console.error("[auth:security] Unexpected error during credential verification:", error);
    return { user: null, failure: AUTH_ERROR_CODES.SERVER_ERROR };
  }
}

/** Boolean-only wrapper returning the authenticated user or `null`. */
export async function verifyCredentials(email: string, password: string): Promise<AuthUser | null> {
  return (await verifyCredentialsDetailed(email, password)).user;
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role?: AuthRole;
  emailVerified?: boolean;
}

export interface CreateUserResult {
  user: AuthUser | null;
  error: string | null;
  code: AuthErrorCode | null;
  source: "database" | "mock";
}

/**
 * Registers a user with sanitized inputs and bcrypt password hashing.
 * Returns a specific error code (`EMAIL_ALREADY_EXISTS`) when the email is taken.
 */
export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const email = normalise(input.email);
  const name = sanitizeInput(input.name);
  const phone = input.phone ? sanitizePhone(input.phone) : undefined;

  const existing = await findUserByEmail(email);
  if (existing) {
    return {
      user: null,
      error: "An account with this email already exists. Please login or use a different email.",
      code: AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS,
      source: "mock",
    };
  }

  const passwordHash = await hash(input.password, BCRYPT_ROUNDS);
  const emailVerified = input.emailVerified ?? true;

  const { data, source } = await withDatabase<UserRecord>(
    async (db) =>
      (await db.user.create({
        data: {
          name,
          email,
          phone: phone ?? null,
          password: passwordHash,
          role: input.role ?? "CUSTOMER",
        },
      })) as UserRecord,
    () => {
      const record: UserRecord = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        email,
        phone,
        password: passwordHash,
        role: input.role ?? "CUSTOMER",
        emailVerified,
      };
      registeredUsers.set(email, record);
      return record;
    },
  );

  return { user: stripPassword(data), error: null, code: null, source };
}

/* -------------------------------------------------------------------------- */
/*  Console Staff Directory (in-memory fallback when no database)             */
/* -------------------------------------------------------------------------- */

function toDemoAccount(account: DemoAccount): AdminUserAccount {
  const trash = demoTrashFor(account.email);

  return {
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone ?? "",
    role: withDemoRole(account).role as SessionRole,
    joinedAt: account.joinedAt,
    deletedAt: trash?.deletedAt ?? null,
    deletedById: trash?.deletedById ?? null,
    deletedBy: trash ? (demoAccountName(trash.deletedById) ?? null) : null,
  };
}

function purgeExpiredDemoTrash(now: Date = new Date()): number {
  let removed = 0;

  for (const [email, entry] of demoTrashOverrides) {
    if (!isTrashExpired(entry.deletedAt, now)) continue;
    demoTrashOverrides.delete(email);
    demoPurged.add(email);
    removed += 1;
  }

  return removed;
}

export function getDemoUserAccounts(): AdminUserAccount[] {
  purgeExpiredDemoTrash();

  return DEMO_ACCOUNTS.filter((account) => !demoPurged.has(account.email)).map(toDemoAccount);
}

export function setDemoUserRole(id: string, role: SessionRole): AdminUserAccount | null {
  const account = DEMO_ACCOUNTS.find((entry) => entry.id === id);
  if (!account) return null;

  demoRoleOverrides.set(account.email, role);

  return { ...toDemoAccount(account), role };
}

/* -------------------------------------------------------------------------- */
/*  Role-change audit trail                                                   */
/* -------------------------------------------------------------------------- */

export const DEMO_ROLE_HISTORY_LIMIT = 20;

let demoRoleChangeSequence = 0;

export function recordDemoRoleChange(entry: {
  userId: string;
  fromRole: SessionRole;
  toRole: SessionRole;
  actorEmail: string;
}): AdminRoleChange {
  demoRoleChangeSequence += 1;

  const row: AdminRoleChange = {
    id: `demo-role-change-${demoRoleChangeSequence}`,
    userId: entry.userId,
    fromRole: entry.fromRole,
    toRole: entry.toRole,
    actorEmail: entry.actorEmail,
    createdAt: new Date().toISOString(),
  };

  const recorded = demoRoleHistory.get(entry.userId) ?? [];
  demoRoleHistory.set(entry.userId, [row, ...recorded].slice(0, DEMO_ROLE_HISTORY_LIMIT));

  return row;
}

export function getDemoRoleHistory(userId: string): AdminRoleChange[] {
  return demoRoleHistory.get(userId) ?? [];
}

export function trashDemoUsers(
  ids: readonly string[],
  deletedById: string,
  now: Date = new Date(),
): AdminUserAccount[] {
  const wanted = new Set(ids);

  for (const account of DEMO_ACCOUNTS) {
    if (!wanted.has(account.id) || !isDemoAccountVisible(account.email)) continue;
    demoTrashOverrides.set(account.email, {
      deletedAt: now.toISOString(),
      deletedById,
    });
  }

  return getDemoUserAccounts().filter(
    (account) => wanted.has(account.id) && Boolean(account.deletedAt),
  );
}

export function restoreDemoUsers(ids: readonly string[]): AdminUserAccount[] {
  const wanted = new Set(ids);

  for (const account of DEMO_ACCOUNTS) {
    if (!wanted.has(account.id)) continue;
    demoTrashOverrides.delete(account.email);
    demoPurged.delete(account.email);
  }

  return getDemoUserAccounts().filter(
    (account) => wanted.has(account.id) && !account.deletedAt,
  );
}

export function purgeDemoUsers(ids: readonly string[]): number {
  const wanted = new Set(ids);
  let removed = 0;

  for (const account of DEMO_ACCOUNTS) {
    if (!wanted.has(account.id) || demoPurged.has(account.email)) continue;
    demoTrashOverrides.delete(account.email);
    demoPurged.add(account.email);
    demoRoleHistory.delete(account.id);
    removed += 1;
  }

  return removed;
}

export function stripPassword(user: UserRecord): AuthUser {
  const { password: _password, ...rest } = user;
  void _password;
  return rest;
}
