/** Local isolated demo + EXTERNAL mocked Cloudflare only. Never run against live accounts. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fixtureVerificationToken } from "./fixture-verification";
import { fixtureToken } from "./turnstile-http-token";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const message = "Security verification failed. Please try again.";
const cookies = new Map<string, string>();
let checks = 0;
let requestNumber = 0;
async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  // Local test requests use distinct documentation-only IPs so security cases
  // test siteverify, not the pre-existing per-IP limiter. No app limiter bypass.
  headers.set("x-forwarded-for", `198.51.100.${++requestNumber % 250 + 1}`);
  headers.set("cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
  const response = await fetch(new URL(path, base), { ...options, headers, redirect: "manual" });
  for (const entry of response.headers.getSetCookie()) {
    const cookie = entry.split(";")[0]!;
    const index = cookie.indexOf("=");
    cookies.set(cookie.slice(0, index), cookie.slice(index + 1));
  }
  return response;
}
async function register(email: string, token: unknown) {
  return request("/api/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Turnstile Test", email, password: "TurnstileHttpPass123!", turnstileToken: token }),
  });
}
async function login(token: unknown, email = "admin@mukra.com", password = "password123") {
  const csrf = await (await request("/api/auth/csrf")).json() as { csrfToken: string };
  const body = new URLSearchParams({ email, password, csrfToken: csrf.csrfToken, callbackUrl: new URL("/admin", base).href });
  if (token !== undefined) body.set("turnstileToken", String(token));
  const response = await request("/api/auth/callback/credentials", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" }, body,
  });
  const result = await response.json() as { url: string };
  return new URL(result.url);
}
async function main() {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local testing only");
  assert.equal(process.env.TEST_DATABASE_ADAPTER, "isolated", "External test database fixture required");
  const health = await (await request("/api/health")).json() as { data: { mode: string } };
  assert.equal(health.data.mode, "live", "Fixture must use the configured-database path");
  const noSecret = process.env.TEST_TURNSTILE_MISSING_SECRET === "true";
  if (noSecret) {
    const failed = await register(`no-secret-${crypto.randomUUID()}@example.com`, "plausible-token");
    assert.equal(failed.status, 403);
    assert.equal((await failed.json() as { code: string }).code, "SECURITY_CHECK_FAILED");
    assert.equal((await login("plausible-token")).searchParams.get("code"), "security-verification-failed");
    assert.equal(await (await request("/api/auth/session")).json(), null);
    process.stdout.write("PASS: real registration API and Credentials callback fail closed without a secret; no session issued.\n");
    return;
  }
  for (const [name, token] of [
    ["missing", undefined], ["empty", ""], ["oversized", "x".repeat(2049)],
    ...["invalid", "expired", "wrong-action", "wrong-host", "network", "http", "json", "truthy"].map(
      (scenario) => [scenario, fixtureToken("register", scenario)],
    ),
  ] as const) {
    const negativeEmail = `negative-${crypto.randomUUID()}@example.com`;
    const response = await register(negativeEmail, token);
    assert.equal(response.status, 403, `Registration must reject ${name}`);
    assert.equal((await response.json() as { code: string }).code, "SECURITY_CHECK_FAILED");
    assert.equal((await register(negativeEmail, fixtureToken("register"))).status, 201, "A rejected check must not create the account");
    checks += 2;
  }
  const email = `turnstile-http-${crypto.randomUUID()}@example.com`;
  const registerToken = fixtureToken("register");
  assert.equal((await register(email, registerToken)).status, 201);
  assert.equal((await register(`replay-${crypto.randomUUID()}@example.com`, registerToken)).status, 403);
  assert.equal(await (await request("/api/auth/session")).json(), null, "Registration is not auto-login");
  checks += 3;
  for (const [name, token] of [
    ["missing", undefined], ["empty", ""], ["oversized", "x".repeat(2049)],
    ...["invalid", "expired", "wrong-action", "wrong-host", "network", "http", "json", "truthy"].map(
      (scenario) => [scenario, fixtureToken("login", scenario)],
    ),
    ["registration action reused for login", fixtureToken("register")],
  ] as const) {
    const url = await login(token);
    assert.equal(url.searchParams.get("error"), "CredentialsSignin", `Login must reject ${name}`);
    assert.equal(url.searchParams.get("code"), "security-verification-failed");
    assert.equal(await (await request("/api/auth/session")).json(), null);
    checks++;
  }
  const badPasswordToken = fixtureToken("login");
  assert.equal((await login(badPasswordToken, email, "wrong-password")).searchParams.get("code"), "invalid-credentials");
  assert.equal((await login(badPasswordToken, email, "TurnstileHttpPass123!")).searchParams.get("code"), "security-verification-failed", "A failed credential attempt consumes its token too");
  assert.equal((await login(fixtureToken("login"), email, "TurnstileHttpPass123!")).searchParams.get("code"), "email-not-verified");
  assert.equal(await (await request("/api/auth/session")).json(), null);
  const verificationToken = await fixtureVerificationToken(email);
  const verification = await request(`/api/auth/verify-email?token=${verificationToken}`);
  assert.equal(new URL(verification.headers.get("location")!, base).pathname, "/auth/verification-success");
  checks += 3;
  assert.equal((await login(fixtureToken("login"), email, "TurnstileHttpPass123!")).searchParams.get("error"), null);
  const customer = await (await request("/api/auth/session")).json() as { user: { email: string; role: string; emailVerified: boolean } };
  assert.equal(customer.user.email, email);
  assert.equal(customer.user.role, "CUSTOMER");
  assert.equal(customer.user.emailVerified, true, "Customer must verify before a session is issued");
  cookies.clear();
  const adminToken = fixtureToken("login");
  assert.equal((await login(adminToken)).searchParams.get("error"), null);
  const admin = await (await request("/api/auth/session")).json() as { user: { role: string } };
  assert.equal(admin.user.role, "SUPER_ADMIN");
  assert.equal((await request("/admin")).status, 200);
  cookies.clear();
  assert.equal((await login(adminToken)).searchParams.get("code"), "security-verification-failed");
  checks += 8;

  const page = await request("/auth/verify-email-pending");
  assert.equal(page.status, 200);
  const manifest = JSON.parse(await readFile(".next/server/server-reference-manifest.json", "utf8")) as {
    node: Record<string, { exportedName?: string; workers: Record<string, unknown> }>;
  };
  const action = Object.entries(manifest.node).find(([, value]) => value.exportedName === "resendVerificationEmail" || Object.keys(value.workers).some((worker) => worker.includes("auth/verify-email-pending")));
  assert.ok(action);
  for (const token of [undefined, fixtureToken("register"), fixtureToken("resend_verification", "wrong-host")]) {
    const response = await request("/auth/verify-email-pending", {
      method: "POST", headers: { "Next-Action": action[0], Origin: new URL(base).origin, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
      body: JSON.stringify([{ email, turnstileToken: token }]),
    });
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes(message), "Direct resend Server Action must enforce its own token");
    checks++;
  }
  process.stdout.write(`PASS: ${checks} Turnstile HTTP security checks through real registration API, Credentials callback and resend Server Action. External mocked Cloudflare; no live-provider claim.\n`);
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Turnstile HTTP test failed");
  process.exitCode = 1;
});
