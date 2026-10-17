/** Offline PostgreSQL/WASM schema+RLS smoke, NOT a live Supabase/Prisma integration test. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { hash, compare } from "bcryptjs";

const db = new PGlite();
let checks = 0;
try {
  await db.exec(await readFile(new URL("schema.sql", import.meta.url), "utf8"));
  for (const file of ["001_enable_rls.sql", "002_rls_helper_functions.sql", "003_rls_policies_accounts.sql", "004_rls_policies_orders.sql", "005_rls_policies_catalog.sql"]) {
    await db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  }
  await db.exec(await readFile(new URL("../../prisma/changes/20261016_email_verification.sql", import.meta.url), "utf8"));
  const password = await hash("OfflineSqlChosenPassword123!", 10);
  const token = randomBytes(32).toString("hex");
  const digest = createHash("sha256").update(token).digest("hex");
  await db.transaction(async (tx) => {
    await tx.query('INSERT INTO "User" (id,name,email,password,"updatedAt") VALUES ($1,$2,$3,$4,now())', ["auth-sql", "Offline SQL", "offline@example.invalid", password]);
    await tx.query('INSERT INTO "VerificationToken" (id,identifier,token,expires) VALUES ($1,$2,$3,now()+interval \'24 hours\')', ["token-sql", "offline@example.invalid", digest]);
  });
  const row = (await db.query('SELECT password,role,"deletedAt","emailVerified" FROM "User" WHERE id=$1', ["auth-sql"])).rows[0];
  assert.ok(row && await compare("OfflineSqlChosenPassword123!", row.password)); checks++;
  assert.equal(row.role, "CUSTOMER"); assert.equal(row.deletedAt, null); assert.equal(row.emailVerified, null); checks++;
  assert.equal((await db.query('SELECT token FROM "VerificationToken" WHERE id=$1', ["token-sql"])).rows[0].token, digest); checks++;
  await assert.rejects(() => db.transaction(async (tx) => {
    await tx.query('INSERT INTO "User" (id,name,email,password,"updatedAt") VALUES ($1,$2,$3,$4,now())', ["rollback-sql", "Rollback", "rollback@example.invalid", password]);
    await tx.query('INSERT INTO "VerificationToken" (id,identifier,token,expires) VALUES ($1,$2,$3,now())', ["duplicate-token", "another@example.invalid", digest]);
  }));
  assert.equal((await db.query('SELECT id FROM "User" WHERE id=$1', ["rollback-sql"])).rows.length, 0); checks++;
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`SET ROLE ${role}`);
    try {
      await assert.rejects(() => db.query('SELECT password FROM "User"')); checks++;
      const tokens = await db.query('SELECT token FROM "VerificationToken"');
      assert.equal(tokens.rows.length, 0); checks++;
    } finally { await db.exec("RESET ROLE"); }
  }
  await db.query('UPDATE "User" SET "emailVerified"=now() WHERE id=$1', ["auth-sql"]);
  assert.ok((await db.query('SELECT "emailVerified" FROM "User" WHERE id=$1', ["auth-sql"])).rows[0].emailVerified); checks++;
  process.stdout.write(`PASS: ${checks} offline PostgreSQL schema/RLS checks: hashed durable row, nullable defaults, token digest, atomic rollback, API-role isolation and owner verification update. No live Supabase/Prisma claim.\n`);
} catch {
  console.error("FAIL: offline auth schema/RLS smoke. No passwords, tokens or query results are printed.");
  process.exitCode = 1;
} finally { await db.close(); }
