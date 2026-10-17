import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { verifyTurnstileToken } from "../lib/turnstile";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
beforeEach(() => {
  process.env = { ...originalEnv, NODE_ENV: "production", TURNSTILE_SECRET_KEY: "unit-test-only-secret", TURNSTILE_ALLOWED_HOSTNAMES: "shop.example.com" };
});
afterEach(() => { process.env = { ...originalEnv }; globalThis.fetch = originalFetch; });

function reply(data: unknown, status = 200) {
  globalThis.fetch = async () => Response.json(data, { status });
}
test("Turnstile verifies via Cloudflare, sends secret only in POST body and disables caching", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal(init?.method, "POST");
    assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal instanceof AbortSignal);
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get("secret"), "unit-test-only-secret");
    assert.equal(body.get("response"), "token");
    return Response.json({ success: true, action: "login", hostname: "SHOP.EXAMPLE.COM" });
  };
  assert.equal(await verifyTurnstileToken("token", { action: "login" }), true);
});
test("Turnstile rejects missing, non-string, empty and oversized tokens before fetching", async () => {
  globalThis.fetch = async () => { throw new Error("Must not reach provider"); };
  for (const token of [undefined, null, 12, {}, [], "", "  ", "x".repeat(2049)]) {
    assert.equal(await verifyTurnstileToken(token, { action: "register" }), false);
  }
});
test("missing secret fails closed even with a plausible token", async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ success: true }); };
  assert.equal(await verifyTurnstileToken("token", { action: "login" }), false);
  assert.equal(calls, 0);
});
test("production requires trusted host configuration", async () => {
  for (const key of ["TURNSTILE_ALLOWED_HOSTNAMES", "AUTH_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_SITE_URL"]) delete process.env[key];
  reply({ success: true, action: "login", hostname: "localhost" });
  assert.equal(await verifyTurnstileToken("token", { action: "login" }), false);
  process.env.AUTH_URL = "https://shop.example.com";
  reply({ success: true, action: "login", hostname: "shop.example.com" });
  assert.equal(await verifyTurnstileToken("token", { action: "login" }), true);
});
test("localhost is implicitly trusted only outside production; explicit allowlist takes precedence", async () => {
  delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;
  process.env = { ...process.env, NODE_ENV: "development" };
  reply({ success: true, action: "register", hostname: "localhost" });
  assert.equal(await verifyTurnstileToken("token", { action: "register" }), true);
  process.env.TURNSTILE_ALLOWED_HOSTNAMES = "shop.example.com";
  assert.equal(await verifyTurnstileToken("token", { action: "register" }), false);
});
for (const [name, payload] of [
  ["invalid token", { success: false, "error-codes": ["invalid-input-response"] }],
  ["expired or replayed token", { success: false, "error-codes": ["timeout-or-duplicate"] }],
  ["string success", { success: "true", action: "login", hostname: "shop.example.com" }],
  ["wrong action", { success: true, action: "register", hostname: "shop.example.com" }],
  ["wrong hostname", { success: true, action: "login", hostname: "evil.shop.example.com" }],
  ["missing binding", { success: true }], ["null response", null], ["array response", []],
] as const) {
  test(`Turnstile rejects ${name}`, async () => {
    reply(payload);
    assert.equal(await verifyTurnstileToken("token", { action: "login" }), false);
  });
}
for (const mode of ["HTTP error", "network error", "abort", "invalid JSON"] as const) {
  test(`Turnstile fails closed on ${mode}`, async () => {
    globalThis.fetch = async () => {
      if (mode === "network error") throw new TypeError("Network unavailable");
      if (mode === "abort") throw new DOMException("Timeout", "TimeoutError");
      return mode === "HTTP error" ? new Response("unavailable", { status: 503 }) : new Response("not JSON");
    };
    assert.equal(await verifyTurnstileToken("token", { action: "login" }), false);
  });
}
