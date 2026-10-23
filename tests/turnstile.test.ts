import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  extractTurnstileToken,
  isTurnstileServerConfigured,
  parseTurnstileRequestRecord,
  verifyTurnstileToken,
} from "../lib/turnstile";
import { TURNSTILE_RESPONSE_FIELD, TURNSTILE_SITE_KEY } from "../lib/turnstile-shared";

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
  const headers = new Headers({ "cf-connecting-ip": "203.0.113.42" });
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal(init?.method, "POST");
    assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal instanceof AbortSignal);
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get("secret"), "unit-test-only-secret");
    assert.equal(body.get("response"), "token");
    assert.equal(body.get("remoteip"), "203.0.113.42");
    return Response.json({ success: true, action: "login", hostname: "SHOP.EXAMPLE.COM" });
  };
  assert.equal(await verifyTurnstileToken("token", { action: "login", requestHeaders: headers }), true);
});

test("configured Turnstile site key constant matches the existing Cloudflare widget", () => {
  assert.equal(TURNSTILE_SITE_KEY, "0x4AAAAAAFR9W3cd66AOTr2B");
  assert.equal(TURNSTILE_RESPONSE_FIELD, "cf-turnstile-response");
});

test("extractTurnstileToken and parseTurnstileRequestRecord parse cf-turnstile-response across JSON and form requests", async () => {
  assert.equal(extractTurnstileToken({ "cf-turnstile-response": "cf-token" }), "cf-token");
  assert.equal(extractTurnstileToken({ "cf-turnstile-response": "cf-token", turnstileToken: "legacy-token" }), "cf-token");
  assert.equal(extractTurnstileToken({ "cf-turnstile-response": "", turnstileToken: "legacy-token" }), "legacy-token");

  const params = new URLSearchParams({ email: "user@example.com", "cf-turnstile-response": "form-token" });
  assert.equal(extractTurnstileToken(params), "form-token");

  const jsonReq = new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user@example.com", password: "secret", "cf-turnstile-response": "json-cf-token" }),
  });
  const parsedJson = await parseTurnstileRequestRecord(jsonReq);
  assert.equal(parsedJson?.formEncoded, false);
  assert.equal(extractTurnstileToken(parsedJson?.record), "json-cf-token");

  const urlReq = new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: "user@example.com", password: "secret", "cf-turnstile-response": "url-cf-token" }),
  });
  const parsedUrl = await parseTurnstileRequestRecord(urlReq);
  assert.equal(parsedUrl?.formEncoded, true);
  assert.equal(extractTurnstileToken(parsedUrl?.record), "url-cf-token");

  const form = new FormData();
  form.set("email", "user@example.com");
  form.set("password", "secret");
  form.set("cf-turnstile-response", "multipart-cf-token");
  const multiReq = new Request("http://localhost/api/auth/login", { method: "POST", body: form });
  const parsedMulti = await parseTurnstileRequestRecord(multiReq);
  assert.equal(parsedMulti?.formEncoded, true);
  assert.equal(extractTurnstileToken(parsedMulti?.record), "multipart-cf-token");

  // verifyTurnstileToken() also extracts cf-turnstile-response directly when passed a payload or FormData
  reply({ success: true, action: "login", hostname: "shop.example.com" });
  assert.equal(await verifyTurnstileToken({ "cf-turnstile-response": "record-cf-token" }, { action: "login" }), true);
  reply({ success: true, action: "login", hostname: "shop.example.com" });
  assert.equal(await verifyTurnstileToken(form, { action: "login" }), true);
});

test("development mode supports explicit TURNSTILE_DEV_BYPASS safely while production ignores it", async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  process.env = { ...process.env, NODE_ENV: "development", TURNSTILE_DEV_BYPASS: "true" };
  assert.equal(isTurnstileServerConfigured(), true);
  assert.equal(await verifyTurnstileToken(undefined, { action: "login" }), true);

  // Production must never honor TURNSTILE_DEV_BYPASS
  process.env = { ...process.env, NODE_ENV: "production", TURNSTILE_DEV_BYPASS: "true", NEXT_PUBLIC_TURNSTILE_DEV_BYPASS: "true" };
  assert.equal(isTurnstileServerConfigured(), false);
  assert.equal(await verifyTurnstileToken("plausible-token", { action: "login" }), false);
});

test("production domain verification handles Vercel aliases, custom www/apex pairs, TURNSTILE_HOSTNAMES and loopback stripping", async () => {
  // 1. Mixed local + prod allowlist strips loopback in production while accepting prod domain
  process.env.TURNSTILE_ALLOWED_HOSTNAMES = "localhost, 127.0.0.1, 2r-m-store.vercel.app";
  reply({ success: true, action: "login", hostname: "2r-m-store.vercel.app" });
  assert.equal(await verifyTurnstileToken("token", { action: "login" }), true);
  reply({ success: true, action: "login", hostname: "localhost" });
  assert.equal(await verifyTurnstileToken("token", { action: "login" }), false);

  // 2. Spin-style TURNSTILE_HOSTNAMES alias works identically
  delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;
  process.env.TURNSTILE_HOSTNAMES = "2r-m-store.vercel.app";
  reply({ success: true, action: "login", hostname: "2r-m-store.vercel.app" });
  assert.equal(await verifyTurnstileToken("token", { action: "login" }), true);
  delete process.env.TURNSTILE_HOSTNAMES;

  // 3. Automatic Vercel production, branch, deployment, and verified x-forwarded-host alias resolution
  process.env.NEXTAUTH_URL = "https://2r-m-store.vercel.app/api/auth";
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
  process.env.VERCEL_URL = "mukra-qp50jmebx-riajul1.vercel.app";
  process.env.VERCEL_BRANCH_URL = "mukra-git-riajulkhandokar-riajul1.vercel.app";
  assert.equal(isTurnstileServerConfigured(), true);

  for (const host of [
    "2r-m-store.vercel.app",
    "mukra-qp50jmebx-riajul1.vercel.app",
    "mukra-git-riajulkhandokar-riajul1.vercel.app",
  ]) {
    reply({ success: true, action: "login", hostname: host });
    assert.equal(await verifyTurnstileToken("token", { action: "login" }), true, `Expected ${host} to pass`);
  }

  // Verified Vercel automatic alias via x-forwarded-host
  const aliasHeaders = new Headers({ "x-forwarded-host": "mukra-riajul1.vercel.app" });
  reply({ success: true, action: "login", hostname: "mukra-riajul1.vercel.app" });
  assert.equal(await verifyTurnstileToken("token", { action: "login", requestHeaders: aliasHeaders }), true);

  // Unrelated .vercel.app tenant still fails
  reply({ success: true, action: "login", hostname: "attacker-project.vercel.app" });
  assert.equal(await verifyTurnstileToken("token", { action: "login", requestHeaders: aliasHeaders }), false);

  // 4. Custom apex <-> www equivalence without opening arbitrary subdomains
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL_BRANCH_URL;
  process.env.NEXTAUTH_URL = "https://mukra.com";
  reply({ success: true, action: "login", hostname: "www.mukra.com" });
  assert.equal(await verifyTurnstileToken("token", { action: "login" }), true);
  reply({ success: true, action: "login", hostname: "evil.mukra.com" });
  assert.equal(await verifyTurnstileToken("token", { action: "login" }), false);
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
test("non-production verification trusts loopback even with an explicit non-local allowlist", async () => {
  delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;
  process.env = { ...process.env, NODE_ENV: "test" };
  reply({ success: true, action: "register", hostname: "localhost" });
  assert.equal(await verifyTurnstileToken("token", { action: "register" }), true);

  // Previously the early return for an explicit allowlist dropped every
  // implicit local hostname and rejected a valid local Cloudflare verdict.
  process.env.TURNSTILE_ALLOWED_HOSTNAMES = "shop.example.com";
  assert.equal(await verifyTurnstileToken("token", { action: "register" }), true);
});

test("local development fails closed without tokens or a server secret", async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  process.env = { ...process.env, NODE_ENV: "development" };
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ success: false }); };
  for (const token of [undefined, null, 12, {}, "", "  ", "invalid-token"]) {
    assert.equal(await verifyTurnstileToken(token, { action: "login" }), false);
  }
  assert.equal(calls, 0);
  assert.equal(isTurnstileServerConfigured(), false);
});

test("localhost, 127.0.0.1 and URL-shaped local configuration compare as one loopback host", async () => {
  process.env.TURNSTILE_ALLOWED_HOSTNAMES = "http://localhost:3000";
  reply({ success: true, action: "login", hostname: "127.0.0.1" });
  assert.equal(await verifyTurnstileToken("token", { action: "login" }), true);

  process.env.TURNSTILE_ALLOWED_HOSTNAMES = "127.0.0.1:3000";
  reply({ success: true, action: "login", hostname: "localhost" });
  assert.equal(await verifyTurnstileToken("token", { action: "login" }), true);
});

test("Cloudflare's official test pair accepts widget tokens with static metadata only outside production", async () => {
  process.env = {
    ...process.env,
    NODE_ENV: "test",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
    TURNSTILE_ALLOWED_HOSTNAMES: "localhost",
  };
  reply({ success: true, action: "test", hostname: "localhost" });
  // The interactive browser widget may produce a token other than Cloudflare's
  // separately documented XXXX.DUMMY.TOKEN.XXXX Siteverify sample.
  assert.equal(await verifyTurnstileToken("browser-widget-test-token", { action: "login" }), true);

  reply({ success: true, hostname: "localhost" });
  assert.equal(await verifyTurnstileToken("browser-widget-test-token", { action: "login" }), true);

  // Static test metadata must never weaken checks for a real widget.
  process.env.TURNSTILE_SECRET_KEY = "real-looking-unit-secret";
  reply({ success: true, action: "test", hostname: "localhost" });
  assert.equal(await verifyTurnstileToken("XXXX.DUMMY.TOKEN.XXXX", { action: "login" }), false);

  // Official dummy secrets are deliberately unusable in production.
  process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
  process.env = { ...process.env, NODE_ENV: "production" };
  globalThis.fetch = async () => { throw new Error("Production test keys must fail before fetching"); };
  assert.equal(await verifyTurnstileToken("XXXX.DUMMY.TOKEN.XXXX", { action: "login" }), false);
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
