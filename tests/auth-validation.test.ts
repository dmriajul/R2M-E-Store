import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/auth/register/route";
import { AUTH_MESSAGES, authErrorMessage, isAuthWarning, loginErrorMessage } from "../lib/auth-messages";
import { authValidationErrors, loginSchema, registerSchema, registerApiSchema, scorePassword, PASSWORD_RULES } from "../lib/validations/auth";
import { installTestDatabase } from "./support/test-database";

const valid = { fullName: "Professional Shopper", email: "shopper@example.com", phone: "", password: "ChosenStrong123!", confirmPassword: "ChosenStrong123!", acceptedTerms: true };
for (const [label, values, message, field] of [
  ["empty email", { email: "" }, AUTH_MESSAGES.EMAIL_REQUIRED, "email"],
  ["whitespace email", { email: "   " }, AUTH_MESSAGES.EMAIL_REQUIRED, "email"],
  ["invalid email", { email: "invalid" }, AUTH_MESSAGES.INVALID_EMAIL, "email"],
  ["empty password", { password: "" }, AUTH_MESSAGES.PASSWORD_REQUIRED, "password"],
] as const) {
  test(`login validation: ${label}`, () => {
    const result = loginSchema.safeParse(Object.assign({ email: valid.email, password: valid.password, remember: true }, values));
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.issues[0]?.path[0], field);
      assert.equal(result.error.issues[0]?.message, message);
    }
  });
}
test("login preserves legacy passwords and normalizes email without mutating password", () => {
  for (const password of ["short", "password123", "  Exact<Aa1!>  ", " ", "a".repeat(100)]) {
    const result = loginSchema.parse({ email: "  Shopper@Example.COM  ", password, remember: true });
    assert.equal(result.email, valid.email);
    assert.equal(result.password, password);
  }
});
for (const [label, values, message, field] of [
  ["missing name", { fullName: "   " }, AUTH_MESSAGES.REQUIRED_FIELDS, "fullName"],
  ["HTML in name", { fullName: "<script>Test</script>" }, AUTH_MESSAGES.INVALID_NAME, "fullName"],
  ["bad email", { email: "test@" }, AUTH_MESSAGES.INVALID_EMAIL, "email"],
  ["short password", { password: "Aa1!abc" }, AUTH_MESSAGES.WEAK_PASSWORD, "password"],
  ["no uppercase", { password: "password123!" }, AUTH_MESSAGES.WEAK_PASSWORD, "password"],
  ["no lowercase", { password: "PASSWORD123!" }, AUTH_MESSAGES.WEAK_PASSWORD, "password"],
  ["no number", { password: "Password!!!!" }, AUTH_MESSAGES.WEAK_PASSWORD, "password"],
  ["no special character", { password: "Password123" }, AUTH_MESSAGES.WEAK_PASSWORD, "password"],
  ["whitespace is not a special character", { password: "Password123 " }, AUTH_MESSAGES.WEAK_PASSWORD, "password"],
  ["bcrypt UTF-8 cap", { password: `Aa1!${"é".repeat(35)}` }, AUTH_MESSAGES.PASSWORD_TOO_LONG, "password"],
  ["mismatch", { confirmPassword: "Different123!" }, AUTH_MESSAGES.PASSWORD_MISMATCH, "confirmPassword"],
  ["confirmation required", { confirmPassword: "" }, AUTH_MESSAGES.CONFIRM_PASSWORD_REQUIRED, "confirmPassword"],
  ["terms required", { acceptedTerms: false }, AUTH_MESSAGES.TERMS_REQUIRED, "acceptedTerms"],
  ["invalid phone", { phone: "<phone>" }, AUTH_MESSAGES.INVALID_PHONE, "phone"],
] as const) {
  test(`registration validation: ${label}`, () => {
    const result = registerSchema.safeParse({ ...valid, ...values });
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.error.issues.some((issue) => issue.path[0] === field && issue.message === message));
  });
}
test("UI/API share safe normalization, five rules, 72-byte boundary and exact passwords", () => {
  const password = `  Aa1!${"x".repeat(64)}  `;
  assert.equal(new TextEncoder().encode(password).length, 72);
  const input = { ...valid, fullName: "  Shopper Name  ", email: " Shopper@Example.COM ", phone: " +880 1700 000000 ", password, confirmPassword: password };
  const ui = registerSchema.parse(input);
  const api = registerApiSchema.parse({ ...input, name: input.fullName, fullName: undefined, role: "SUPER_ADMIN" });
  assert.equal(api.name, ui.fullName);
  assert.equal(api.email, ui.email);
  assert.equal(api.phone, ui.phone);
  assert.equal(api.password, password);
  assert.equal(ui.password, password);
  assert.equal("role" in api, false);
  assert.equal(PASSWORD_RULES.length, 5);
  assert.equal(scorePassword(""), 0);
  assert.equal(scorePassword(valid.password), 5);
  assert.ok(registerSchema.safeParse(valid).success, "Phone is optional on both sides");
  assert.ok(registerApiSchema.safeParse({ name: valid.fullName, email: valid.email, password: valid.password }).success, "Legacy API clients need not send confirmation/terms");
});
test("fixed mappings handle unknown/prototype values safely; login never suggests a fixture account", () => {
  for (const value of [undefined, "", "<script>secret</script>", "toString", "__proto__", {}, null]) {
    assert.equal(authErrorMessage(value), AUTH_MESSAGES.SERVER_ERROR);
  }
  for (const [code, message] of [
    ["invalid-credentials", "Invalid email or password. Please try again."],
    ["email-not-verified", "Please verify your email address before logging in. Check your inbox."],
    ["too-many-attempts", "Too many failed attempts. Please try again later or reset your password."],
    ["account-service-unavailable", "Something went wrong. Please try again later."],
  ]) assert.equal(loginErrorMessage(code), message);
  assert.ok(isAuthWarning("EMAIL_NOT_VERIFIED"));
  assert.ok(isAuthWarning("ACCOUNT_LOCKED"));
  assert.equal(isAuthWarning("INVALID_CREDENTIALS"), false);
  assert.doesNotMatch(JSON.stringify(AUTH_MESSAGES), /demo|admin@mukra|password123/i);
});
test("empty registration emits required codes, not Zod data or supplied values", () => {
  const result = registerApiSchema.safeParse({});
  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(authValidationErrors(result.error), { code: "REQUIRED_FIELDS", fieldErrors: { name: "REQUIRED_FIELDS", email: "EMAIL_REQUIRED", password: "PASSWORD_REQUIRED" } });
  }
});

const env = { ...process.env };
const originalFetch = globalThis.fetch;
const originalError = console.error;
const scope = globalThis as typeof globalThis & { prisma?: unknown; prismaUnavailable?: boolean };
afterEach(() => { process.env = { ...env }; globalThis.fetch = originalFetch; console.error = originalError; delete scope.prisma; delete scope.prismaUnavailable; });
function setup() {
  const fixture = installTestDatabase();
  process.env.TURNSTILE_SECRET_KEY = "unit-only-secret";
  process.env.TURNSTILE_ALLOWED_HOSTNAMES = "localhost";
  globalThis.fetch = async () => Response.json({ success: true, action: "register", hostname: "localhost" });
  console.error = () => {};
  return fixture;
}
function request(values: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": crypto.randomUUID() },
    body: JSON.stringify({ name: valid.fullName, email: valid.email, password: valid.password, turnstileToken: "unit-token", ...values }) });
}
test("registration API returns specific field codes for invalid email/strength/mismatch without database access", async () => {
  setup();
  delete process.env.DATABASE_URL;
  for (const [values, code, field] of [
    [{ email: "not-an-email" }, "INVALID_EMAIL", "email"],
    [{ password: "weak" }, "WEAK_PASSWORD", "password"],
    [{ confirmPassword: "Different123!" }, "PASSWORD_MISMATCH", "confirmPassword"],
  ] as const) {
    const response = await POST(request(values));
    assert.equal(response.status, 422);
    const body = await response.json() as { code: string; fieldErrors: Record<string, string> };
    assert.equal(body.code, code);
    assert.equal(body.fieldErrors[field], code);
  }
});
test("registration API duplicates normalize case; failed security does not disclose account status", async () => {
  const fixture = setup();
  assert.equal((await POST(request({}))).status, 201);
  const duplicate = await POST(request({ email: "  SHOPPER@EXAMPLE.COM " }));
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await duplicate.json(), { data: null, success: false, error: "EMAIL_ALREADY_EXISTS", code: "EMAIL_ALREADY_EXISTS", fieldErrors: { email: "EMAIL_ALREADY_EXISTS" } });
  assert.equal(fixture.rows("user").length, 1);
  globalThis.fetch = async () => Response.json({ success: false });
  const denied = await POST(request({}));
  assert.equal(denied.status, 400);
  assert.equal((await denied.json() as { code: string }).code, "SECURITY_CHECK_FAILED");
});
test("registration API storage errors never leak secrets, provider messages, SQL, or passwords", async () => {
  const fixture = setup();
  fixture.db.user.findFirst = async () => { throw new Error(`private://connection/${valid.password}`); };
  const response = await POST(request({}));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { data: null, success: false, error: "SERVER_ERROR", code: "SERVER_ERROR" });
});
