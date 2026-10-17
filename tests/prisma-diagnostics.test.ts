import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { DatabaseUnavailableError, databaseFailureReason, getPrisma, requireDatabase } from "../lib/prisma";

const originalEnv = { ...process.env };
const scope = globalThis as typeof globalThis & { prisma?: unknown };
afterEach(() => {
  process.env = { ...originalEnv };
  delete scope.prisma;
});

test("missing and malformed DATABASE_URL fail closed without logging credentials", async (context) => {
  const log = context.mock.method(console, "error", () => {});
  delete process.env.DATABASE_URL;
  await assert.rejects(() => requireDatabase(async () => true), DatabaseUnavailableError);
  process.env.DATABASE_URL = "  ";
  await assert.rejects(() => requireDatabase(async () => true), DatabaseUnavailableError);
  process.env.DATABASE_URL = "postgresql://user:secret@localhost/";
  await assert.rejects(() => getPrisma(), DatabaseUnavailableError);
  assert.ok(log.mock.calls.some(({ arguments: args }) => String(args[0]).includes("DATABASE_URL")));
  assert.ok(log.mock.calls.every(({ arguments: args }) => !JSON.stringify(args).includes("secret")));
});

test("connection and schema failures become maintenance errors with safe diagnostics", async (context) => {
  process.env.DATABASE_URL = "postgresql://user:secret@localhost:5432/store";
  scope.prisma = {};
  const log = context.mock.method(console, "error", () => {});
  for (const [code, hint] of [["P1000", "authentication"], ["P1001", "host unreachable"],
    ["P2024", "pool exhausted"], ["P2022", "column missing"]]) {
    const cause = Object.assign(new Error("postgresql://user:secret@localhost/store"), { code });
    await assert.rejects(() => requireDatabase(async () => { throw cause; }),
      (error: unknown) => error instanceof DatabaseUnavailableError && error.cause === cause);
    assert.match(databaseFailureReason(cause) ?? "", new RegExp(hint ?? ""));
  }
  assert.ok(log.mock.calls.some(({ arguments: args }) => String(args[0]).includes("P1000")));
  assert.ok(log.mock.calls.every(({ arguments: args }) => !JSON.stringify(args).includes("secret")));
  const unrelated = new Error("application bug");
  await assert.rejects(() => requireDatabase(async () => { throw unrelated; }), (error) => error === unrelated);
});
