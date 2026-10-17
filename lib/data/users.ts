/** Durable accounts use Prisma User + bcrypt only. Demo directory below is UI-only development data, never a login source. */

import type { NewVerificationTokenRecord } from "@/lib/verification-tokens";
import { compare, hash } from "bcryptjs";
import { requireDatabase, DatabaseUnavailableError } from "@/lib/prisma";
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD } from "@/lib/demo-mode";
import { isTrashExpired } from "@/lib/rbac";
import type { AdminRoleChange, AdminUserAccount, AuthRole, AuthUser, SessionRole } from "@/types";

export const BCRYPT_ROUNDS = 10;

export interface UserRecord extends AuthUser {
  /** bcrypt hash for persisted accounts; UI-only demo directory is not authenticatable. */
  password: string;
}

interface DemoAccount extends UserRecord {
  demo: true;
  /** Fixed join date so the console's "Joined" column is stable across renders. */
  joinedAt: string;
}

/**
 * Role changes made from **Staff & Roles** while no database is connected.
 *
 * The demo accounts are module constants, so an override map is the only way a
 * super admin's change can be both visible in the console *and* honoured on the
 * next sign-in. Keyed by normalised email; cleared when the server restarts
 * (a database install writes to Postgres instead — see `lib/data/admin-users.ts`).
 */
const demoScope = globalThis as typeof globalThis & {
  __mukraDemoRoleOverrides?: Map<string, SessionRole>;
  /** Emails parked in the demo trash → when, and by which super admin. */
  __mukraDemoTrashOverrides?: Map<string, DemoTrashEntry>;
  /** Emails deleted for good while no database is connected. */
  __mukraDemoPurged?: Set<string>;
  /** Role-change audit trail per demo account id, newest first. */
  __mukraDemoRoleHistory?: Map<string, AdminRoleChange[]>;
};

/** One demo account sitting in the trash. */
interface DemoTrashEntry {
  /** ISO timestamp — the retention countdown in the console reads it directly. */
  deletedAt: string;
  deletedById: string;
}

/**
 * The map lives on `globalThis` rather than in this module on purpose: Next.js
 * compiles the console's server components, the Server Actions and the Auth.js
 * route handler into separate server bundles, so a module-level `Map` would
 * exist once **per bundle** — a role change recorded by the action would be
 * invisible to the login route. One map per process keeps all three in step.
 */
const demoRoleOverrides: Map<string, SessionRole> = (demoScope.__mukraDemoRoleOverrides ??= new Map<
  string,
  SessionRole
>());

/**
 * Trashed demo accounts and hard-deleted ones, keyed by normalised email and
 * kept on `globalThis` for the same one-map-per-process reason as the roles
 * above. Together they mirror the `User.deletedAt` column: an account in
 * `demoTrashOverrides` is invisible to sign-in and listed under
 * **Staff & Roles → Trash**, and an email in `demoPurged` is gone entirely.
 */
const demoTrashOverrides: Map<string, DemoTrashEntry> = (demoScope.__mukraDemoTrashOverrides ??=
  new Map<string, DemoTrashEntry>());

const demoPurged: Set<string> = (demoScope.__mukraDemoPurged ??= new Set<string>());

/**
 * The demo **role-change audit trail**, keyed by account id and stamped newest
 * first — the in-memory twin of the `RoleChange` table, kept on `globalThis` for
 * the same one-map-per-process reason as the overrides above. It is dropped when
 * the server restarts, exactly like every other demo override, and a purged
 * account takes its trail with it (the database does that with `onDelete:
 * Cascade`).
 */
const demoRoleHistory: Map<string, AdminRoleChange[]> = (demoScope.__mukraDemoRoleHistory ??=
  new Map<string, AdminRoleChange[]>());

const normalise = (email: string): string => email.trim().toLowerCase();

/** True when sign-in may use this demo account (not trashed, not purged). */
function isDemoAccountVisible(email: string): boolean {
  const key = normalise(email);
  return !demoPurged.has(key) && !demoTrashOverrides.has(key);
}

/** Demo display name behind a `deletedById`, or `undefined` for an unknown id. */
function demoAccountName(id: string): string | undefined {
  return DEMO_ACCOUNTS.find((entry) => entry.id === id)?.name;
}

/** Applies any pending demo override to an account record. */
function withDemoRole(account: UserRecord): UserRecord {
  const override = demoRoleOverrides.get(normalise(account.email));
  return override ? { ...account, role: override } : account;
}

/** The trash state of one demo account, if it is in the trash at all. */
function demoTrashFor(email: string): DemoTrashEntry | undefined {
  return demoTrashOverrides.get(normalise(email));
}

/**
 * Accounts that always exist so the demo (and each RBAC role) can be signed
 * into. Every account uses the shared demo password (`password123`).
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: "demo-admin",
    name: "Riajul Khandokar",
    email: DEMO_ADMIN_EMAIL,
    phone: "+880 1712 345678",
    password: DEMO_PASSWORD,
    role: "SUPER_ADMIN",
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
    demo: true,
    joinedAt: "2025-03-09T14:20:00.000Z",
  },
] as const;

/**
 * Looks a user up by email (no password check).
 *
 * **Trashed accounts are not found.** A row with `deletedAt` set (or a demo
 * account in the trash) is invisible here, which is what makes the soft delete
 * real: the account cannot sign in. Its email remains reserved by @unique
 * until the account is permanently purged.
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
export type CredentialFailure = "invalid-credentials";

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
): Promise<CredentialResult> {
  const user = await findUserByEmail(email);
  // Always do one bcrypt comparison, including missing/trashed/invalid-hash rows.
  // This reduces the obvious existence timing signal; DB/network latency is not constant-time.
  const validHash = Boolean(user && /^\$2[aby]\$(?:0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/.test(user.password));
  const dummyHash = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
  const matches = await compare(password, validHash && user ? user.password : dummyHash).catch(() => false);
  return user && validHash && matches
    ? { user: stripPassword(user), failure: null }
    : { user: null, failure: "invalid-credentials" };
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

/* -------------------------------------------------------------------------- */
/*  Demo directory (no database)                                              */
/* -------------------------------------------------------------------------- */

/** One demo account as the console reads it, trash state included. */
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

/**
 * The demo trash's stand-in for the purge cron.
 *
 * Nothing runs on a schedule without a database, so the retention window is
 * applied lazily the moment the console reads the list: an entry that outlived
 * `TRASH_RETENTION_DAYS` is dropped — exactly what the cron would have done to
 * it. Demo accounts hold no orders, so the "keeps its orders" rule that protects
 * real customers has nothing to hold on to here.
 */
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

/**
 * Every demo account as the Staff & Roles console lists them — **trashed ones
 * included**, matching `getAdminUserAccounts()` and the `User.deletedAt`
 * column, so the same components drive both modes.
 */
export function getDemoUserAccounts(): AdminUserAccount[] {
  assertDevelopmentDirectory();
  purgeExpiredDemoTrash();

  return DEMO_ACCOUNTS.filter((account) => !demoPurged.has(account.email)).map(toDemoAccount);
}

/**
 * Records a role change for a demo account so the console list *and* the next
 * sign-in agree. Returns the updated account, or `null` for an unknown id.
 */
export function setDemoUserRole(id: string, role: SessionRole): AdminUserAccount | null {
  assertDevelopmentDirectory();
  const account = DEMO_ACCOUNTS.find((entry) => entry.id === id);
  if (!account) return null;

  demoRoleOverrides.set(account.email, role);

  return { ...toDemoAccount(account), role };
}

/* -------------------------------------------------------------------------- */
/*  Demo role-change audit trail                                              */
/* -------------------------------------------------------------------------- */

/** Trail rows kept per demo account — enough for the sheet, bounded for the process. */
export const DEMO_ROLE_HISTORY_LIMIT = 20;

/** Demo rows are never persisted, so a counter is all the id they need. */
let demoRoleChangeSequence = 0;

/**
 * Demo-mode twin of `recordRoleChange()` (`lib/data/admin-users.ts`) — called by
 * `updateUserRoleAction` when no database is connected, so the console's **Role
 * history** section works identically in both modes.
 *
 * The row is written in memory and therefore cannot fail; it returns the row it
 * recorded (the database path returns `void` and logs its own failures).
 */
export function recordDemoRoleChange(entry: {
  userId: string;
  fromRole: SessionRole;
  toRole: SessionRole;
  actorEmail: string;
}): AdminRoleChange {
  assertDevelopmentDirectory();
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

/** One demo account's trail, newest first (empty when nothing was recorded). */
export function getDemoRoleHistory(userId: string): AdminRoleChange[] {
  assertDevelopmentDirectory();
  return demoRoleHistory.get(userId) ?? [];
}

/**
 * Moves demo accounts to the trash.
 *
 * An account that is already trashed keeps its original timestamp — the console
 * shows a countdown, and a double-click must not restart it. Returns the rows
 * the caller asked for that are now in the trash.
 */
export function trashDemoUsers(
  ids: readonly string[],
  deletedById: string,
  now: Date = new Date(),
): AdminUserAccount[] {
  assertDevelopmentDirectory();
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

/** Takes demo accounts back out of the trash. Returns the restored rows. */
export function restoreDemoUsers(ids: readonly string[]): AdminUserAccount[] {
  assertDevelopmentDirectory();
  const wanted = new Set(ids);

  for (const account of DEMO_ACCOUNTS) {
    if (!wanted.has(account.id)) continue;
    demoTrashOverrides.delete(account.email);
    demoPurged.delete(account.email);
  }

  return getDemoUserAccounts().filter((account) => wanted.has(account.id) && !account.deletedAt);
}

/**
 * Deletes demo accounts for good (they vanish from the list and can no longer
 * sign in). Returns how many were removed; already-purged ids are not counted.
 */
export function purgeDemoUsers(ids: readonly string[]): number {
  assertDevelopmentDirectory();
  const wanted = new Set(ids);
  let removed = 0;

  for (const account of DEMO_ACCOUNTS) {
    if (!wanted.has(account.id) || demoPurged.has(account.email)) continue;
    demoTrashOverrides.delete(account.email);
    demoPurged.add(account.email);
    /* Cascade parity: deleting the account deletes its audit trail too. */
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

/** Server-derived session flag; Credentials enforces verification for new customer sessions. */
export async function getUserEmailVerificationStatus(id: string): Promise<boolean> {
  return requireDatabase(async (db) => {
    const user = (await db.user.findUnique({ where: { id },
      select: { emailVerified: true, deletedAt: true } })) as { emailVerified: Date | null; deletedAt: Date | null } | null;
    return Boolean(user && !user.deletedAt && user.emailVerified);
  });
}

/** Old demo staff directory remains development-only, never a production fallback. */
function assertDevelopmentDirectory(): void {
  if (process.env.NODE_ENV === "production") throw new DatabaseUnavailableError();
}
