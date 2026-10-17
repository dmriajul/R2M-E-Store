/** Local isolated production-build checks. No live DB/provider claim. */
import assert from "node:assert/strict";
import { fixtureToken } from "./turnstile-http-token";
import { AUTH_MESSAGES, authErrorMessage, loginErrorMessage } from "../lib/auth-messages";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3139";
let checks = 0;
async function register(values: Record<string, unknown>) {
  return fetch(new URL("/api/auth/register", base), { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": crypto.randomUUID() },
    body: JSON.stringify({ ...values, turnstileToken: fixtureToken("register") }) });
}
async function main() {
  assert.equal(process.env.TEST_DATABASE_ADAPTER, "isolated");
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
  for (const path of ["/login", "/register"]) {
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.doesNotMatch(text, /demo mode|admin@mukra\.com|password123|no shopper uses|we couldn&#x27;t find that account/i);
    assert.match(text, /type="submit"[^>]*disabled=""/);
    assert.match(text, /data-turnstile-action=/);
    checks += 3;
  }
  const valid = { name: "Contract Shopper", email: `messages-${crypto.randomUUID()}@example.com`, password: "ChosenContract123!", confirmPassword: "ChosenContract123!", acceptedTerms: true };
  for (const [values, code, field] of [
    [{}, "REQUIRED_FIELDS", "email"],
    [{ ...valid, email: "" }, "REQUIRED_FIELDS", "email"],
    [{ ...valid, password: "" }, "REQUIRED_FIELDS", "password"],
    [{ ...valid, email: "invalid" }, "INVALID_EMAIL", "email"],
    [{ ...valid, password: "weak", confirmPassword: "weak" }, "WEAK_PASSWORD", "password"],
    [{ ...valid, confirmPassword: "Different123!" }, "PASSWORD_MISMATCH", "confirmPassword"],
  ] as const) {
    const response = await register(values);
    assert.equal(response.status, 422);
    const body = await response.json() as { code: string; fieldErrors: Record<string, string>; error: string };
    assert.equal(body.code, code);
    assert.ok(body.fieldErrors[field]);
    assert.equal(body.error, body.code, "API transports codes, not raw provider messages");
    assert.ok(!Object.values(body).includes(valid.password));
    checks += 5;
  }
  assert.equal((await register(valid)).status, 201);
  const duplicate = await register({ ...valid, email: `  ${valid.email.toUpperCase()}  ` });
  assert.equal(duplicate.status, 409);
  assert.equal(authErrorMessage((await duplicate.json() as { code: string }).code), AUTH_MESSAGES.EMAIL_ALREADY_EXISTS);
  checks += 3;

  // The incoming dedicated login API must not become a captcha/verification bypass.
  for (const [values, status, code] of [
    [{ email: valid.email, password: valid.password, turnstileToken: undefined }, 403, "SECURITY_CHECK_FAILED"],
    [{ email: valid.email, password: valid.password, turnstileToken: fixtureToken("register") }, 403, "SECURITY_CHECK_FAILED"],
    [{ email: `api-unknown-${crypto.randomUUID()}@example.com`, password: valid.password }, 401, "INVALID_CREDENTIALS"],
    [{ email: valid.email, password: "incorrect" }, 401, "INVALID_CREDENTIALS"],
    [{ email: "not-an-email", password: valid.password }, 401, "INVALID_CREDENTIALS"],
    [{ email: valid.email, password: valid.password }, 403, "EMAIL_NOT_VERIFIED"],
    [{ email: "admin@mukra.com", password: "password123" }, 200, null],
  ] as const) {
    const response = await fetch(new URL("/api/auth/login", base), { method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": crypto.randomUUID() },
      body: JSON.stringify(Object.assign({ turnstileToken: fixtureToken("login") }, values)) });
    assert.equal(response.status, status);
    assert.equal((await response.json() as { code: string | null }).code, code);
    assert.equal(response.headers.getSetCookie().length, 0, "Preflight must not create a session");
    assert.match(response.headers.get("cache-control") ?? "", /(?:^|[,\s])no-store(?:$|[,\s])/);
    checks += 4;
  }

  const cookies = new Map<string, string>();
  async function request(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    headers.set("cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
    headers.set("x-forwarded-for", "192.0.2.222");
    const response = await fetch(new URL(path, base), { ...options, headers, redirect: "manual" });
    for (const header of response.headers.getSetCookie()) {
      const cookie = header.split(";")[0]!; const i = cookie.indexOf("=");
      cookies.set(cookie.slice(0, i), cookie.slice(i + 1));
    }
    return response;
  }
  // Exercise the total-request IP limiter separately from the new shared failed-password lockout.
  for (let attempt = 0; attempt < 21; attempt++) {
    const csrf = await (await request("/api/auth/csrf")).json() as { csrfToken: string };
    const values = attempt === 0 ? { email: "", password: "" } : attempt === 1 ? { email: "not-an-email", password: "incorrect" } : { email: `invalid-format-${attempt}`, password: "incorrect" };
    const response = await request("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
      body: new URLSearchParams({ ...values, csrfToken: csrf.csrfToken, turnstileToken: fixtureToken("login"), callbackUrl: new URL("/dashboard", base).href }) });
    const url = new URL((await response.json() as { url: string }).url);
    const code = url.searchParams.get("code") ?? undefined;
    assert.equal(code, attempt < 20 ? "invalid-credentials" : "too-many-attempts");
    assert.equal(loginErrorMessage(code), attempt < 20 ? AUTH_MESSAGES.INVALID_CREDENTIALS : AUTH_MESSAGES.ACCOUNT_LOCKED);
    assert.equal(await (await request("/api/auth/session")).json(), null);
    checks += 3;
  }
  process.stdout.write(`PASS: ${checks} production HTTP message/validation/rate-limit checks.\n`);
}
main().catch(() => {
  console.error(`Auth message HTTP contract failed after ${checks} completed checks. No credentials or token URLs are printed.`);
  process.exitCode = 1;
});
