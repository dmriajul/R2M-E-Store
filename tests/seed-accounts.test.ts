import assert from "node:assert/strict";
import { test } from "node:test";
import { compare } from "bcryptjs";
import { upsertAccount, assertStrongPassword } from "../prisma/seed";
import { createTestDatabase } from "./support/test-database";

test("seed hashes credentials, preserves passwords, and refuses staff demotion", async () => {
  const fixture = createTestDatabase();
  const input = { name: "Master Admin", email: "admin@mukra.com", password: "SeedStrong123!", role: "SUPER_ADMIN" as const };
  assert.equal(await upsertAccount(input, fixture.db), "created");
  const row = fixture.rows("user")[0]!;
  assert.notEqual(row.password, input.password);
  assert.equal(await compare(input.password, String(row.password)), true);
  assert.equal(await upsertAccount(input, fixture.db), "unchanged");
  await assert.rejects(upsertAccount({ ...input, password: "Different123!" }, fixture.db), /password differs/);
  await assert.rejects(upsertAccount({ ...input, role: "CUSTOMER" }, fixture.db), /demote/);
  assert.equal(fixture.rows("user")[0]!.password, row.password);
});

test("customer seed is verified on creation and weak/overlong passwords fail policy", async () => {
  const fixture = createTestDatabase();
  await upsertAccount({ name: "Test Customer", email: "customer@example.com", password: "CustomerStrong123!", role: "CUSTOMER", emailVerified: true }, fixture.db);
  assert.ok(fixture.rows("user")[0]!.emailVerified);
  assert.throws(() => assertStrongPassword("password123", "test"));
  assert.throws(() => assertStrongPassword("Aa1!" + "x".repeat(70), "test"));
});
