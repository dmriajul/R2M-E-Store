/**
 * Users — database when configured, demo accounts otherwise.
 *
 * Passwords are hashed with bcrypt in the database path. In demo mode a set of
 * well-known accounts exists so **every console role can be tried without a
 * database**: the super admin (and the legacy `ADMIN` alias), one account per
 * manager role, and a shopper (`sarah@example.com`). All of them share the demo
 * password `password123`; any other email also works with it, mirroring the mock
 * auth the storefront shipped with — those sessions are always `CUSTOMER` unless
 * a demo account matches, so the extra accounts can't leak console access.
 */

import { compare, hash } from "bcryptjs";
import { withDatabase } from "@/lib/prisma";
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD, isDatabaseConfigured } from "@/lib/demo-mode";
import type {
  AdminUserAccount,
  AuthRole,
  AuthUser,
  SessionRole,
} from "@/types";

export const BCRYPT_ROUNDS = 10;

export interface UserRecord extends AuthUser {
  /** bcrypt hash in the database path, plain demo password otherwise. */
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
};

/**
 * The map lives on `globalThis` rather than in this module on purpose: Next.js
 * compiles the console's server components, the Server Actions and the Auth.js
 * route handler into separate server bundles, so a module-level `Map` would
 * exist once **per bundle** — a role change recorded by the action would be
 * invisible to the login route. One map per process keeps all three in step.
 */
const demoRoleOverrides: Map<string, SessionRole> = (demoScope.__mukraDemoRoleOverrides ??=
  new Map<string, SessionRole>());

/** Applies any pending demo override to an account record. */
function withDemoRole(account: UserRecord): UserRecord {
  const override = demoRoleOverrides.get(normalise(account.email));
  return override ? { ...account, role: override } : account;
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

const normalise = (email: string): string => email.trim().toLowerCase();

function demoUserFor(email: string, password: string): UserRecord | null {
  const account = DEMO_ACCOUNTS.find((entry) => entry.email === normalise(email));
  if (account && password === account.password) return withDemoRole(account);

  // Any other email works with the shared demo password.
  if (!account && password === DEMO_PASSWORD) {
    const local = normalise(email).split("@")[0] ?? "friend";
    const name = local
      .split(/[._-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    return {
      id: `demo-${local}`,
      name: name || "Demo Shopper",
      email: normalise(email),
      password,
      role: "CUSTOMER",
    };
  }

  return null;
}

/** Looks a user up by email (no password check). */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const { data } = await withDatabase<UserRecord | null>(
    async (db) => {
      const row = (await db.user.findUnique({ where: { email: normalise(email) } })) as
        | (AuthUser & { password: string })
        | null;
      return row;
    },
    () => {
      const account = DEMO_ACCOUNTS.find((entry) => entry.email === normalise(email));
      return account ? withDemoRole(account) : null;
    },
  );

  return data;
}

/** Why a credentials check failed — surfaced to the login form as a code. */
export type CredentialFailure = "unknown-email" | "wrong-password";

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

  if (!user) {
    // Demo mode: unknown emails still work with the shared demo password.
    const demo = isDatabaseConfigured() ? null : demoUserFor(email, password);
    return demo
      ? { user: demo, failure: null }
      : { user: null, failure: "unknown-email" };
  }

  if (user.password.startsWith("$2")) {
    const matches = await compare(password, user.password).catch(() => false);
    return matches
      ? { user: stripPassword(user), failure: null }
      : { user: null, failure: "wrong-password" };
  }

  if (password === user.password) return { user: stripPassword(user), failure: null };

  // Database-configured install whose hash is missing — fall back to demo rules.
  const demo = isDatabaseConfigured() ? null : demoUserFor(email, password);
  return demo ? { user: demo, failure: null } : { user: null, failure: "wrong-password" };
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

/** Registers a user, or returns a friendly error (duplicate email / demo rules). */
export async function createUser(
  input: CreateUserInput,
): Promise<{ user: AuthUser | null; error: string | null; source: "database" | "mock" }> {
  const email = normalise(input.email);

  const existing = await findUserByEmail(email);
  if (existing) return { user: null, error: "That email is already registered", source: "mock" };

  const passwordHash = await hash(input.password, BCRYPT_ROUNDS);

  const { data, source } = await withDatabase<UserRecord>(
    async (db) =>
      (await db.user.create({
        data: {
          name: input.name,
          email,
          phone: input.phone ?? null,
          password: passwordHash,
          role: input.role ?? "CUSTOMER",
        },
      })) as UserRecord,
    () => ({
      id: `demo-${email.split("@")[0] ?? "user"}`,
      name: input.name,
      email,
      phone: input.phone,
      password: passwordHash,
      role: input.role ?? "CUSTOMER",
    }),
  );

  return { user: stripPassword(data), error: null, source };
}

/* -------------------------------------------------------------------------- */
/*  Demo directory (no database)                                              */
/* -------------------------------------------------------------------------- */

/** The demo accounts as the Staff & Roles console lists them. */
export function getDemoUserAccounts(): AdminUserAccount[] {
  return DEMO_ACCOUNTS.map((account) => ({
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone ?? "",
    role: withDemoRole(account).role as SessionRole,
    joinedAt: account.joinedAt,
  }));
}

/**
 * Records a role change for a demo account so the console list *and* the next
 * sign-in agree. Returns the updated account, or `null` for an unknown id.
 */
export function setDemoUserRole(id: string, role: SessionRole): AdminUserAccount | null {
  const account = DEMO_ACCOUNTS.find((entry) => entry.id === id);
  if (!account) return null;

  demoRoleOverrides.set(account.email, role);

  return {
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone ?? "",
    role,
    joinedAt: account.joinedAt,
  };
}

export function stripPassword(user: UserRecord): AuthUser {
  const { password: _password, ...rest } = user;
  void _password;
  return rest;
}
