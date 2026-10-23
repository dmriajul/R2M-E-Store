import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/auth/login/route";
import { createUser, verifyCredentialsDetailed, isAccountLocked, resetLoginRateLimits, getFailedLoginAuditLog, MAX_LOGIN_ATTEMPTS, LOGIN_LOCKOUT_WINDOW_MS } from "../lib/data/users";
import { validateLoginServerInput, validateRegistrationServerInput, checkPasswordStrength, getLoginErrorMessage, getRegisterErrorMessage, forgotPasswordSchema, sanitizeEmail, AUTH_ERROR_CODES } from "../lib/validations/auth";
import { AUTH_MESSAGES } from "../lib/auth-messages";
import { installTestDatabase } from "./support/test-database";

const env = { ...process.env };
const originalFetch = globalThis.fetch;
const scope = globalThis as typeof globalThis & { prisma?: unknown; prismaUnavailable?: boolean };
afterEach(() => {
  resetLoginRateLimits(); process.env = { ...env }; globalThis.fetch = originalFetch;
  delete scope.prisma; delete scope.prismaUnavailable;
});
function setup() {
  const fixture = installTestDatabase();
  process.env.TURNSTILE_SECRET_KEY = "unit-only-secret";
  process.env.TURNSTILE_ALLOWED_HOSTNAMES = "localhost";
  globalThis.fetch = async () => Response.json({ success: true, action: "login", hostname: "localhost" });
  return fixture;
}
const password = "ChosenMergedPass123!";
function request(values: Record<string, unknown>, ip = crypto.randomUUID()) {
  return new NextRequest("http://localhost/api/auth/login", { method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email: "merged@example.com", password, turnstileToken: "unit-token", ...values }) });
}

test("merged validation compatibility uses the same strong registration and legacy-safe login schemas", () => {
  const login = validateLoginServerInput({ email: "  Legacy@Example.COM  ", password: " old " });
  assert.equal(login.ok, true);
  if (login.ok) { assert.equal(login.data.email, "legacy@example.com"); assert.equal(login.data.password, " old "); }
  assert.equal(validateLoginServerInput({ email: "bad", password }).ok, false);
  assert.equal(validateRegistrationServerInput({ name: "Merged Shopper", email: "merged@example.com", password, confirmPassword: "wrong" }).ok, false);
  assert.equal(validateRegistrationServerInput({ name: "Merged Shopper", email: "merged@example.com", password }).ok, true);
  assert.equal(checkPasswordStrength("ChosenPass123").valid, false, "Special character remains required");
  assert.equal(checkPasswordStrength(password).score, 5);
  assert.equal(checkPasswordStrength(`Aa1!${"é".repeat(35)}`).valid, false);
  assert.equal(forgotPasswordSchema.parse({ email: "  Merged@Example.COM " }).email, "merged@example.com");
  assert.equal(sanitizeEmail("<Merged>@Example.COM"), "<merged>@example.com", "Must not silently convert a malformed email into an account address");
});
test("merged uppercase/lowercase message helpers share safe professional copy", () => {
  assert.equal(getLoginErrorMessage("invalid-credentials").message, AUTH_MESSAGES.INVALID_CREDENTIALS);
  assert.equal(getLoginErrorMessage(AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED).message, AUTH_MESSAGES.EMAIL_NOT_VERIFIED);
  assert.equal(getLoginErrorMessage("toString").message, AUTH_MESSAGES.SERVER_ERROR);
  assert.equal(getRegisterErrorMessage("__proto__").message, AUTH_MESSAGES.SERVER_ERROR);
  assert.equal(getRegisterErrorMessage("WEAK_PASSWORD").message, AUTH_MESSAGES.WEAK_PASSWORD);
  assert.equal(getLoginErrorMessage("ACCOUNT_LOCKED").severity, "warning");
});
test("merged account lockout: fifth failed password locks, correct password cannot bypass, expiry recovers legacy admin", async (context) => {
  setup();
  const warnings = context.mock.method(console, "warn", () => {});
  const email = "legacy-merged@example.com";
  const ip = "192.0.2.71";
  await createUser({ name: "Legacy Admin", email, password: " old ", role: "ADMIN" });
  for (let attempt = 1; attempt <= MAX_LOGIN_ATTEMPTS; attempt++) {
    const result = await verifyCredentialsDetailed(email.toUpperCase(), "incorrect", { ip });
    assert.equal(result.failure, attempt === MAX_LOGIN_ATTEMPTS ? "too-many-attempts" : "invalid-credentials");
  }
  assert.equal(isAccountLocked(email, ip), true);
  assert.equal((await verifyCredentialsDetailed(email, " old ", { ip })).failure, "too-many-attempts");
  const output = JSON.stringify(warnings.mock.calls.map((call) => call.arguments));
  assert.doesNotMatch(output, /legacy-merged@example|192\.0\.2\.71|incorrect| old /);
  const audit = getFailedLoginAuditLog().slice(0, 5);
  assert.equal(audit.length, 5);
  assert.ok(audit.every((entry) => /^email:[a-f0-9]{64}$/.test(entry.accountId)));
  assert.ok(audit.every((entry) => !Object.hasOwn(entry, "email") && !Object.hasOwn(entry, "ip")));
  const now = Date.now();
  context.mock.method(Date, "now", () => now + LOGIN_LOCKOUT_WINDOW_MS + 1);
  assert.equal(isAccountLocked(email, ip), false);
  assert.equal((await verifyCredentialsDetailed(email, " old ", { ip })).user?.role, "ADMIN");
});
test("merged successful password check clears account attempts without changing bcrypt credentials", async (context) => {
  setup(); context.mock.method(console, "warn", () => {});
  await createUser({ name: "Merged Shopper", email: "merged@example.com", password });
  for (let attempt = 0; attempt < 3; attempt++) await verifyCredentialsDetailed("merged@example.com", "wrong");
  assert.ok((await verifyCredentialsDetailed("merged@example.com", password)).user);
  for (let attempt = 0; attempt < 4; attempt++) assert.equal((await verifyCredentialsDetailed("merged@example.com", "wrong")).failure, "invalid-credentials");
});
test("merged IP lockout aggregates failures across different accounts", async (context) => {
  setup(); context.mock.method(console, "warn", () => {});
  const ip = "192.0.2.72";
  for (let attempt = 1; attempt <= MAX_LOGIN_ATTEMPTS * 2; attempt++) {
    assert.equal((await verifyCredentialsDetailed(`unknown-${attempt}@example.com`, "incorrect", { ip })).failure,
      attempt === MAX_LOGIN_ATTEMPTS * 2 ? "too-many-attempts" : "invalid-credentials");
  }
  assert.equal(isAccountLocked("another@example.com", ip), true);
});
test("merged login API cannot bypass captcha or query account status without a solved challenge", async () => {
  const fixture = setup();
  let reads = 0;
  fixture.db.user.findFirst = async () => { reads++; return null; };
  globalThis.fetch = async () => Response.json({ success: false });
  const response = await POST(request({ turnstileToken: "" }));
  assert.equal(response.status, 400);
  assert.equal((await response.json() as { code: string }).code, "SECURITY_CHECK_FAILED");
  assert.equal(reads, 0);
});
test("local development login API requires CAPTCHA before inspecting credentials", async () => {
  setup();
  process.env = { ...process.env, NODE_ENV: "development" };
  delete process.env.TURNSTILE_SECRET_KEY;
  const response = await POST(request({ turnstileToken: undefined }, "192.0.2.77"));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "invalid_captcha");
});

test("merged login API uses generic errors for missing/malformed fields with valid captcha", async () => {
  setup();
  for (const values of [{ email: "", password: "" }, { email: "invalid" }]) {
    const response = await POST(request(values));
    assert.equal(response.status, 401);
    assert.equal((await response.json() as { code: string }).code, "INVALID_CREDENTIALS");
  }
});
test("merged login API unknown email and wrong password have identical safe responses", async (context) => {
  setup(); context.mock.method(console, "warn", () => {});
  await createUser({ name: "Merged Shopper", email: "merged@example.com", password });
  const unknown = await POST(request({ email: "unknown@example.com" }));
  const wrong = await POST(request({ password: "incorrect" }));
  assert.equal(unknown.status, 401); assert.equal(wrong.status, 401);
  assert.deepEqual(await unknown.json(), await wrong.json());
  assert.equal(unknown.headers.get("cache-control"), "no-store");
});
test("merged login API enforces customer verification and never creates a session", async () => {
  const fixture = setup();
  await createUser({ name: "Merged Shopper", email: "merged@example.com", password });
  const denied = await POST(request({}));
  assert.equal(denied.status, 403);
  assert.equal((await denied.json() as { code: string }).code, "EMAIL_NOT_VERIFIED");
  await fixture.db.user.update({ where: { email: "merged@example.com" }, data: { emailVerified: new Date() } });
  const verified = await POST(request({}));
  assert.equal(verified.status, 200);
  const body = await verified.json() as { data: Record<string, unknown> };
  assert.equal(body.data.email, "merged@example.com");
  assert.equal(body.data.password, undefined);
  assert.equal(body.data.token, undefined);
  assert.equal(verified.headers.getSetCookie().length, 0);
});
test("merged login API preserves nullable legacy ADMIN and short exact passwords", async () => {
  setup();
  await createUser({ name: "Legacy Admin", email: "merged@example.com", password: " old ", role: "ADMIN" });
  assert.equal((await POST(request({ password: " old " }))).status, 200);
});
test("merged login API storage failure exposes no diagnostics or credentials", async (context) => {
  const fixture = setup(); context.mock.method(console, "error", () => {});
  fixture.db.user.findFirst = async () => { throw new Error(`private-connection/${password}`); };
  const response = await POST(request({}));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { data: null, error: "SERVER_ERROR", code: "SERVER_ERROR", success: false });
});
test("merged login API accepts canonical cf-turnstile-response in JSON and URL-encoded form requests", async () => {
  const fixture = setup();
  await createUser({ name: "CF Token Shopper", email: "merged@example.com", password });
  await fixture.db.user.update({ where: { email: "merged@example.com" }, data: { emailVerified: new Date() } });

  const seenTokens: string[] = [];
  globalThis.fetch = async (_url, init) => {
    const params = new URLSearchParams(String(init?.body));
    seenTokens.push(params.get("response") ?? "");
    return Response.json({ success: true, action: "login", hostname: "localhost" });
  };

  const jsonLogin = await POST(new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.77" },
    body: JSON.stringify({ email: "merged@example.com", password, "cf-turnstile-response": "cf-json-login-token" }),
  }));
  assert.equal(jsonLogin.status, 200);

  const formLogin = await POST(new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "x-forwarded-for": "198.51.100.78" },
    body: new URLSearchParams({ email: "merged@example.com", password, "cf-turnstile-response": "cf-form-login-token" }).toString(),
  }));
  assert.equal(formLogin.status, 200);
  assert.deepEqual(seenTokens, ["cf-json-login-token", "cf-form-login-token"]);
});

test("merged API and Credentials password service share the same account lockout", async (context) => {
  setup(); context.mock.method(console, "warn", () => {});
  await createUser({ name: "Merged Admin", email: "merged@example.com", password, role: "SUPER_ADMIN" });
  for (let attempt = 1; attempt <= MAX_LOGIN_ATTEMPTS; attempt++) {
    const response = await POST(request({ password: "incorrect" }));
    assert.equal(response.status, attempt === MAX_LOGIN_ATTEMPTS ? 429 : 401);
  }
  assert.equal((await verifyCredentialsDetailed("merged@example.com", password)).failure, "too-many-attempts");
});
