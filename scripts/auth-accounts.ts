/* eslint-disable no-console -- CLI report intentionally writes to stdout. */
/**
 * Local account & credential report — `npm run auth:accounts`.
 *
 * Answers the question "what can I sign in with?" in one screen:
 *
 *   1. The master admin / author account (SUPER_ADMIN) taken from `ADMIN_*`.
 *   2. The optional test customer taken from `SEED_TEST_CUSTOMER_*`.
 *   3. Every console account that actually exists in the database.
 *   4. The exact steps to sign in, and to create another Author (staff) account.
 *
 * Nothing here hardcodes a credential — every value is read from the
 * environment, so a fresh clone still has zero default passwords. Passwords are
 * masked by default; local display requires `--show-passwords` and is always
 * disabled when `NODE_ENV=production`.
 *
 * The script never writes. With no database reachable it still reports the
 * configured accounts and marks the database rows as unknown.
 */

import { isDatabaseConfigured, requireDatabase } from "../lib/prisma";
import { loadEnvFiles } from "../prisma/load-env";

// Must run before any query: `lib/prisma` reads DATABASE_URL lazily, so filling
// process.env first is what makes DATABASE_URL in `.env.local` visible here.
const loaded = loadEnvFiles();

const MASK = "••••••••••••";
const RULE = "─".repeat(66);

const revealPasswords =
  process.argv.includes("--show-passwords") && process.env.NODE_ENV !== "production";

interface AccountRow {
  name: string | null;
  email: string;
  role: string;
  emailVerified: Date | null;
}

interface ReportedAccount {
  label: string;
  email: string;
  password: string;
  role: string;
  variables: readonly string[];
  /** null when the database could not be queried. */
  database: { exists: boolean; role: string | null; verified: boolean | null } | null;
}

function heading(title: string): void {
  console.log("");
  console.log(RULE);
  console.log(` ${title}`);
  console.log(RULE);
}

function password(value: string): string {
  if (!value) return "—";
  return revealPasswords ? value : MASK;
}

function configured(variables: readonly string[]): string {
  return variables.every((name) => (process.env[name] ?? "").length > 0) ? "set" : "MISSING";
}

function status(account: ReportedAccount): string {
  if (account.database === null) return "database unreachable";
  if (!account.database.exists) return "not in database — run `npm run db:seed`";
  const verified = account.database.verified === null ? "" : account.database.verified ? ", verified" : ", email not verified";
  return `present as ${account.database.role ?? "unknown"}${verified}`;
}

function printAccount(index: number, account: ReportedAccount): void {
  console.log("");
  console.log(` ${index}. ${account.label}  (${account.role})`);
  console.log(`    email     ${account.email || "—"}`);
  console.log(`    password  ${password(account.password)}`);
  console.log(`    env       ${account.variables.join(", ")} — ${configured(account.variables)}`);
  console.log(`    database  ${status(account)}`);
  console.log(`    sign in   /login${account.role === "SUPER_ADMIN" ? "  →  /admin" : "  →  /dashboard"}`);
}

async function findAccount(email: string): Promise<AccountRow | null> {
  if (!email) return null;
  const rows = await requireDatabase(async (db) =>
    (await db.user.findMany({
      where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
      select: { name: true, email: true, role: true, emailVerified: true },
      take: 1,
    })) as unknown as AccountRow[],
  );
  return rows[0] ?? null;
}

async function listStaff(): Promise<AccountRow[] | null> {
  return requireDatabase(async (db) =>
    (await db.user.findMany({
      where: { role: { notIn: ["CUSTOMER"] }, deletedAt: null },
      select: { name: true, email: true, role: true, emailVerified: true },
      take: 50,
    })) as unknown as AccountRow[],
  );
}

async function countCustomers(): Promise<number | null> {
  return requireDatabase(async (db) => db.user.count({ where: { role: "CUSTOMER", deletedAt: null } }));
}

async function main(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  const customerEmail = process.env.SEED_TEST_CUSTOMER_EMAIL?.trim().toLowerCase() ?? "";
  const customerPassword = process.env.SEED_TEST_CUSTOMER_PASSWORD ?? "";

  const databaseConfigured = isDatabaseConfigured();
  let reachable = false;
  if (databaseConfigured) {
    try {
      await countCustomers();
      reachable = true;
    } catch {
      reachable = false;
    }
  }

  const adminRow = reachable ? await findAccount(adminEmail).catch(() => null) : null;
  const customerRow = reachable ? await findAccount(customerEmail).catch(() => null) : null;
  const staff = reachable ? await listStaff().catch(() => null) : null;
  const customers = reachable ? await countCustomers().catch(() => null) : null;

  heading("MUKRA — local accounts & credentials");
  console.log(` env files      ${loaded.length > 0 ? loaded.join(", ") : "none found (.env / .env.local)"}`);
  console.log(` DATABASE_URL   ${databaseConfigured ? "set" : "MISSING — the app renders its maintenance state"}`);
  console.log(` database       ${!databaseConfigured ? "not configured" : reachable ? "reachable" : "configured but unreachable — check the URI, network and schema"}`);
  console.log(` passwords      ${revealPasswords ? "shown (local aid — never commit, never share)" : "masked"}`);

  heading("Accounts");
  printAccount(1, {
    label: "Master admin / author",
    email: adminEmail,
    password: adminPassword,
    role: "SUPER_ADMIN",
    variables: ["ADMIN_NAME", "ADMIN_EMAIL", "ADMIN_PASSWORD"],
    database: reachable
      ? { exists: adminRow !== null, role: adminRow?.role ?? null, verified: adminRow ? adminRow.emailVerified !== null : null }
      : null,
  });
  printAccount(2, {
    label: "Test customer",
    email: customerEmail,
    password: customerPassword,
    role: "CUSTOMER",
    variables: ["SEED_TEST_CUSTOMER_EMAIL", "SEED_TEST_CUSTOMER_PASSWORD"],
    database: reachable
      ? { exists: customerRow !== null, role: customerRow?.role ?? null, verified: customerRow ? customerRow.emailVerified !== null : null }
      : null,
  });

  if (staff) {
    heading("Console accounts in the database");
    if (staff.length === 0) {
      console.log(" none — seed the master admin with `npm run db:seed`.");
    } else {
      for (const row of staff) {
        console.log(` ${(row.role ?? "").padEnd(18)} ${row.email.padEnd(34)} ${row.name ?? ""}`);
      }
    }
    console.log(` customers in the database: ${customers ?? "unknown"}`);
  }

  heading("Sign in");
  console.log(" 1. npm run dev");
  console.log(" 2. Open /login and use the master admin email and password above.");
  console.log(" 3. A SUPER_ADMIN lands in /admin; a CUSTOMER lands in /dashboard.");
  console.log(" 4. Local Turnstile: put Cloudflare's always-pass test keys in .env.local —");
  console.log("    NEXT_PUBLIC_TURNSTILE_SITE_KEY=\"1x00000000000000000000AA\"");
  console.log("    TURNSTILE_SECRET_KEY=\"1x0000000000000000000000000000000AA\"");
  console.log("    TURNSTILE_ALLOWED_HOSTNAMES=\"localhost\"");

  heading("Create another Author (console staff) account");
  console.log(" There is no AUTHOR role: console authors are staff accounts, and");
  console.log(" SUPER_ADMIN is the master one with every permission.");
  console.log("");
  console.log(" a. Register the person at /register  (password is bcrypt-hashed, role CUSTOMER).");
  console.log("    Their email must be verified before a CUSTOMER can sign in — with");
  console.log("    DEBUG_VERIFICATION_EMAILS=\"true\" the link is printed to the server console.");
  console.log(" b. Sign in as the master admin and open /admin/staff.");
  console.log(" c. Change their role to SUPER_ADMIN, INVENTORY_MANAGER, SEO_MANAGER or");
  console.log("    SUPPORT_MANAGER. They sign in again to pick up the new permissions.");
  console.log("");
  console.log(" Bulk/CLI alternative — one SUPER_ADMIN per email, re-runnable:");
  console.log("   ADMIN_NAME=\"Jane\" ADMIN_EMAIL=\"jane@mukra.com\" ADMIN_PASSWORD=\"…\" \\");
  console.log("     npm run db:seed");

  heading("Security");
  console.log(" • No credentials are hardcoded in this repository. The seed reads");
  console.log("   ADMIN_* from the environment and refuses to run without them.");
  console.log(" • `password123`-style passwords are rejected: the seed applies the same");
  console.log("   five rules as /register (8+ chars, upper, lower, number, special).");
  console.log(" • Passwords are stored as bcrypt hashes (10 rounds) only.");

  console.log(" Environment passwords are proposed inputs, NOT recovered database passwords.");
  console.log(" Seed reruns preserve existing passwords; they fail on a mismatch.");
  const { getPrisma } = await import("../lib/prisma");
  if (reachable) await (await getPrisma())?.$disconnect?.();
  console.log("");
}

main().catch((error: unknown) => {
  console.error("[auth:accounts] failed:", error);
  process.exitCode = 1;
});

