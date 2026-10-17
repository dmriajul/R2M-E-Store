import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { compare } from "bcryptjs";
import { GET as readiness } from "../app/api/ready/route";
import { POST } from "../app/api/auth/register/route";
import { createUser, verifyCredentialsDetailed } from "../lib/data/users";
import { DatabaseUnavailableError, withDatabase, withRequiredDatabase } from "../lib/prisma";
import { newVerificationToken } from "../lib/verification-tokens";
import { LOGIN_MESSAGES, loginErrorMessage } from "../lib/auth-messages";
import { installTestDatabase } from "./support/test-database";

const env = { ...process.env };
const fetchOriginal = globalThis.fetch;
const errorOriginal = console.error;
const scope = globalThis as typeof globalThis & { prisma?: unknown; prismaUnavailable?: boolean };
afterEach(() => { process.env = { ...env }; globalThis.fetch = fetchOriginal; console.error = errorOriginal; delete scope.prisma; delete scope.prismaUnavailable; });
function setup() {
  const fixture = installTestDatabase();
  process.env.TURNSTILE_SECRET_KEY = "unit-only-secret";
  process.env.TURNSTILE_ALLOWED_HOSTNAMES = "localhost";
  globalThis.fetch = async () => Response.json({ success: true, action: "register", hostname: "localhost" });
  // after() is intentionally unavailable outside a request scope in unit tests.
  console.error = () => {};
  return fixture;
}
function request(email: string) {
  return new NextRequest("http://localhost/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": crypto.randomUUID() },
    body: JSON.stringify({ name: "Durable Customer", email, password: "ChosenDurablePass123!", turnstileToken: "unit-token", role: "SUPER_ADMIN" }) });
}

test("registration integration: API commits a User + hashed token and the same credentials authenticate", async () => {
  const fixture = setup();
  const email = `durable-${crypto.randomUUID()}@example.com`;
  const response = await POST(request(email));
  assert.equal(response.status, 201);
  const payload = await response.json() as { data: Record<string, unknown> };
  const stored = fixture.rows("user").find((row) => row.email === email);
  assert.ok(stored, "A successful response must correspond to a stored row in the contract database");
  assert.equal(stored.role, "CUSTOMER");
  assert.equal(stored.deletedAt, null);
  assert.equal(stored.emailVerified, null);
  assert.equal(await compare("ChosenDurablePass123!", String(stored.password)), true);
  assert.equal(payload.data.password, undefined);
  assert.equal(payload.data.source, "database");
  assert.equal(fixture.rows("verificationToken").length, 1);
  assert.match(String(fixture.rows("verificationToken")[0]?.token), /^[a-f0-9]{64}$/);
  const login = await verifyCredentialsDetailed(email.toUpperCase(), "ChosenDurablePass123!");
  assert.equal(login.user?.id, stored.id);
  assert.equal(login.user?.emailVerified, null, "Credential helper verifies passwords only; the provider enforces customer verification");
});

test("transaction rollback: token insertion failure cannot leave a user or report successful registration", async () => {
  const fixture = setup();
  fixture.db.verificationToken.upsert = async () => { throw new Error("schema/permissions/outage"); };
  const response = await POST(request("rollback@example.com"));
  assert.equal(response.status, 503);
  assert.equal(fixture.rows("user").length, 0);
  assert.equal(fixture.rows("verificationToken").length, 0);
  assert.equal((await response.json() as { success: boolean }).success, false);
});

test("missing database never creates accounts or authenticates known demo admins, even with ALLOW_DEMO_MODE", async () => {
  setup();
  delete process.env.DATABASE_URL;
  process.env.ALLOW_DEMO_MODE = "true";
  for (const nodeEnv of ["development", "production"] as const) {
    process.env = { ...process.env, NODE_ENV: nodeEnv };
    assert.equal((await POST(request(`${nodeEnv}@example.com`))).status, 503);
    await assert.rejects(() => verifyCredentialsDetailed("admin@mukra.com", "password123"), DatabaseUnavailableError);
  }
  await assert.rejects(() => withRequiredDatabase(async () => true, () => false), DatabaseUnavailableError);
  // Storefront catalogue reads (`withDatabase`) keep their documented mock
  // fallback when a deployment is unconfigured — including in production — so
  // a fresh Vercel deploy without env vars renders the demo catalogue instead
  // of the "Something went wrong" error page. Account flows above stay
  // fail-closed; `withRequiredDatabase` still rejects everywhere.
  for (const nodeEnv of ["development", "production"] as const) {
    process.env = { ...process.env, NODE_ENV: nodeEnv };
    const result = await withDatabase(async (): Promise<boolean> => true, () => false);
    assert.equal(result.data, false);
    assert.equal(result.source, "mock");
  }
});

test("production read outages cannot serve mock catalogue or order data", async () => {
  setup();
  process.env = { ...process.env, NODE_ENV: "production" };
  let fallback = false;
  await assert.rejects(() => withDatabase(async () => { throw new Error("read outage"); }, () => { fallback = true; return "fake"; }), /read outage/);
  assert.equal(fallback, false);
});

test("login flow: unknown email/wrong password fail safely, correct password and persisted legacy admin succeed", async () => {
  setup();
  await createUser({ name: "Legacy Admin", email: "legacy@example.com", password: "ChosenDurablePass123!", role: "ADMIN" }, newVerificationToken("legacy@example.com").record);
  assert.equal((await verifyCredentialsDetailed("unknown@example.com", "ChosenDurablePass123!")).failure, "invalid-credentials");
  assert.equal((await verifyCredentialsDetailed("legacy@example.com", "wrong-password")).failure, "invalid-credentials");
  assert.equal((await verifyCredentialsDetailed("legacy@example.com", "ChosenDurablePass123!")).user?.role, "ADMIN");
  assert.match(loginErrorMessage("invalid-credentials"), /Invalid email or password. Please try again./);
  assert.match(loginErrorMessage("account-service-unavailable"), /Something went wrong. Please try again later./);
  assert.notEqual(LOGIN_MESSAGES["invalid-credentials"], loginErrorMessage("account-service-unavailable"));
  assert.equal(loginErrorMessage(undefined), LOGIN_MESSAGES["account-service-unavailable"]);
});

test("duplicate email races do not create two durable accounts", async () => {
  const fixture = setup();
  const input = { name: "Race", email: "race@example.com", password: "ChosenDurablePass123!" };
  const results = await Promise.all([createUser(input), createUser(input)]);
  assert.equal(results.filter((result) => result.user).length, 1);
  assert.equal(fixture.rows("user").length, 1);
});

test("readiness probes real auth/token queries and never reports missing configuration as ready", async () => {
  const fixture = setup();
  process.env.AUTH_SECRET = "unit-only-auth-secret";
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "unit-public-key";
  assert.equal((await readiness()).status, 200);
  fixture.db.user.findFirst = async () => { throw new Error("sensitive connection details"); };
  const failed = await readiness();
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes("sensitive"));
  delete process.env.DATABASE_URL;
  assert.equal((await readiness()).status, 503);
});
