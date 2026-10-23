/**
 * Seed script — production bootstrap.
 *
 *   npx prisma db push     # create the tables
 *   npm run db:seed        # run this file
 *
 * It creates exactly one thing by default: the first SUPER_ADMIN account, so
 * you can sign in to the console and add the real catalogue. Credentials come
 * from the environment (see `.env.example`) and are never hardcoded.
 *
 *   ADMIN_NAME="Your Name"
 *   ADMIN_EMAIL="you@example.com"
 *   ADMIN_PASSWORD="a-long-random-password"
 *
 * Optionally, one *test customer* can be created alongside it so local
 * sign-in checks have a shopper account without walking the registration
 * form. It is opt-in through the environment and refused in production:
 *
 *   SEED_TEST_CUSTOMER_EMAIL="customer@mukra.com"
 *   SEED_TEST_CUSTOMER_PASSWORD="a-long-random-password"
 *
 * There are no demo products, orders or coupons here — the database
 * starts empty, and the storefront shows its empty states until you add real
 * products through the console (Admin → Products → Add Product).
 *
 * Run `npm run auth:accounts` at any time to print the configured accounts and
 * the exact sign-in steps.
 */

import { PrismaClient } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import type { PrismaLikeClient } from "../lib/prisma";
import { authEmailSchema, registrationPasswordSchema, PASSWORD_RULES } from "../lib/validations/auth";
import { loadEnvFiles } from "./load-env";

// The Prisma CLI only sources `.env`; `.env.local` is where the README keeps
// local configuration. Load both before anything reads `process.env`.
loadEnvFiles();

export const BCRYPT_ROUNDS = 10;

/* -------------------------------------------------------------------------- */
/*  Credential policy                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The seed refuses weak passwords.
 *
 * `lib/validations/auth.ts` enforces these same rules on `/register`, so
 * seeding something like `password123` would create an account the app's own
 * registration policy would reject. Failing loudly here keeps the bootstrap account
 * and the registration path consistent.
 */
export function assertStrongPassword(password: string, label: string): void {
  const unmet = PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.label);
  if (registrationPasswordSchema.safeParse(password).success) return;
  throw new Error(
    `${label} does not satisfy the account password policy (failed: ${unmet.join("; ")}). ` +
      "The same rules are enforced on /register. Use 8+ characters including uppercase, lowercase, number and special character (at most 72 UTF-8 bytes).",
  );
}

export function readAdminEnv(): { name: string; email: string; password: string } {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";

  const missing = [
    ["ADMIN_NAME", name],
    ["ADMIN_EMAIL", email],
    ["ADMIN_PASSWORD", password],
  ].filter(([, value]) => !value || String(value).trim().length === 0);

  if (missing.length > 0) {
    const keys = missing.map(([key]) => key).join(", ");
    throw new Error(
      `Set ${keys} in your environment (or .env) before seeding. ` +
        "The super-admin account is created from environment variables — " +
        "there are no default demo credentials.",
    );
  }

  if (!authEmailSchema.safeParse(email).success) throw new Error("ADMIN_EMAIL must be a valid email.");
  assertStrongPassword(password, "ADMIN_PASSWORD");
  return { name: name!, email: email!, password };
}

/** Optional shopper account. `null` when neither variable is set. */
export function readTestCustomerEnv(): { name: string; email: string; password: string } | null {
  const email = process.env.SEED_TEST_CUSTOMER_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.SEED_TEST_CUSTOMER_PASSWORD ?? "";
  const name = process.env.SEED_TEST_CUSTOMER_NAME?.trim() || "Test Customer";

  if (!email && !password) return null;

  if (!email || !password) {
    throw new Error(
      "Set both SEED_TEST_CUSTOMER_EMAIL and SEED_TEST_CUSTOMER_PASSWORD (or neither) before seeding.",
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SEED_TEST_CUSTOMER_* is a local development convenience and is refused when NODE_ENV=production. " +
        "Unset it, or create the account through /register.",
    );
  }

  if (!authEmailSchema.safeParse(email).success) throw new Error("SEED_TEST_CUSTOMER_EMAIL must be a valid email.");
  assertStrongPassword(password, "SEED_TEST_CUSTOMER_PASSWORD");
  return { name, email, password };
}

/* -------------------------------------------------------------------------- */
/*  Database                                                                   */
/* -------------------------------------------------------------------------- */

let client: PrismaClient | null = null;

/** Built on first use so importing this module in a test never opens a connection. */
function db(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

export type SeedRole = "SUPER_ADMIN" | "CUSTOMER";
export type SeedOutcome = "created" | "promoted" | "unchanged";

/** Creates the account, or aligns an existing one on a re-run. Idempotent. */
export async function upsertAccount(input: {
  name: string;
  email: string;
  password: string;
  role: SeedRole;
  /** Customers must be verified to sign in; staff accounts are unaffected. */
  emailVerified?: boolean;
}, database?: Pick<PrismaLikeClient, "user">): Promise<SeedOutcome> {
  const users = database?.user ?? db().user;
  const existing = await users.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" } },
    select: { id: true, role: true, password: true, deletedAt: true },
  });

  if (existing) {
    const row = existing as { id: string; role: string; password: string; deletedAt: Date | null };
    if (row.deletedAt) throw new Error("Seed account is in trash; restore it explicitly first.");
    if (!await compare(input.password, row.password).catch(() => false)) {
      throw new Error("Existing seed account password differs from supplied environment. No changes made; use the account password-change flow.");
    }
    if (input.role === "CUSTOMER" && row.role !== "CUSTOMER") {
      throw new Error("Test customer email belongs to staff. Refusing to demote it.");
    }
    if (row.role !== input.role) {
      await users.update({ where: { id: row.id }, data: { role: input.role } });
      console.warn(`[seed] ${input.email} already existed — role set to ${input.role}.`);
      return "promoted";
    }
    console.warn(`[seed] ${input.email} is already a ${input.role}; nothing to do.`);
    return "unchanged";
  }

  await users.create({
    data: {
      name: input.name,
      email: input.email,
      password: await hash(input.password, BCRYPT_ROUNDS),
      role: input.role,
      ...(input.emailVerified ? { emailVerified: new Date() } : {}),
    },
  });

  console.warn(`[seed] ${input.role} ${input.email} created.`);
  return "created";
}

export async function main(): Promise<void> {
  const admin = readAdminEnv();
  const customer = readTestCustomerEnv();

  if (customer?.email === admin.email) throw new Error("Admin and customer emails must differ.");

  const adminOutcome = await upsertAccount({ ...admin, role: "SUPER_ADMIN" });
  const customerOutcome = customer
    ? await upsertAccount({ ...customer, role: "CUSTOMER", emailVerified: true })
    : null;

  console.warn("");
  console.warn("[seed] ──────────────────────────────────────────────────────────");
  console.warn("[seed]  Accounts configured for this database");
  console.warn("[seed] ──────────────────────────────────────────────────────────");
  console.warn(`[seed]   Master admin / author   ${admin.email}  (SUPER_ADMIN, ${adminOutcome})`);
  console.warn("[seed]                            password: the ADMIN_PASSWORD you supplied");
  if (customer && customerOutcome) {
    console.warn(`[seed]   Test customer           ${customer.email}  (CUSTOMER, ${customerOutcome})`);
    console.warn("[seed]                            password: the SEED_TEST_CUSTOMER_PASSWORD you supplied");
  } else {
    console.warn("[seed]   Test customer           not configured — create one at /register");
  }
  console.warn("[seed] ──────────────────────────────────────────────────────────");
  console.warn("[seed] Sign in at /login. Run `npm run auth:accounts` for the full list.");
}

/* Runs only when executed directly (`npm run db:seed`), not when imported. */
if (require.main === module) {
  main()
    .catch((error: unknown) => {
      console.warn("[seed] failed:", error);
      process.exitCode = 1;
    })
    .finally(() => {
      void client?.$disconnect();
    });
}
