/**
 * Users — database when configured, demo accounts otherwise.
 *
 * Passwords are hashed with bcrypt in the database path. In demo mode two
 * well-known accounts exist (`admin@littleluxe.com / admin123` and
 * `sarah@example.com / password123`) and *any* email works with
 * `password123`, mirroring the mock auth the storefront shipped with.
 */

import { compare, hash } from "bcryptjs";
import { withDatabase } from "@/lib/prisma";
import {
  DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_PASSWORD,
  DEMO_PASSWORD,
  isDatabaseConfigured,
} from "@/lib/demo-mode";
import type { AuthRole, AuthUser } from "@/types";

export const BCRYPT_ROUNDS = 10;

export interface UserRecord extends AuthUser {
  /** bcrypt hash in the database path, plain demo password otherwise. */
  password: string;
}

interface DemoAccount extends UserRecord {
  demo: true;
}

/** Accounts that always exist so the demo can be signed into. */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: "demo-admin",
    name: "Riajul Khandokar",
    email: DEMO_ADMIN_EMAIL,
    phone: "+880 1712 345678",
    password: DEMO_ADMIN_PASSWORD,
    role: "ADMIN",
    demo: true,
  },
  {
    id: "demo-sarah",
    name: "Sarah Ahmed",
    email: "sarah@example.com",
    phone: "+880 1812 445566",
    password: DEMO_PASSWORD,
    role: "CUSTOMER",
    demo: true,
  },
] as const;

const normalise = (email: string): string => email.trim().toLowerCase();

function demoUserFor(email: string, password: string): UserRecord | null {
  const account = DEMO_ACCOUNTS.find((entry) => entry.email === normalise(email));
  if (account && password === account.password) return account;

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
    () => DEMO_ACCOUNTS.find((entry) => entry.email === normalise(email)) ?? null,
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

export function stripPassword(user: UserRecord): AuthUser {
  const { password: _password, ...rest } = user;
  void _password;
  return rest;
}
