/** AUTHORIZED STAGING ONLY. No provider/database mocks. Creates a customer and optionally an order. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { compare } from "bcryptjs";
import { requireDatabase, getPrisma } from "../lib/prisma";
import { prepareVerificationResend } from "../lib/email-verification";
import type { Product } from "../types";

let stage = "configuration";
const cookies = new Map<string, string>();
let base: URL;
async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
  const response = await fetch(new URL(path, base), { ...options, headers, redirect: "manual" });
  for (const header of response.headers.getSetCookie()) {
    const cookie = header.split(";")[0]!; const i = cookie.indexOf("=");
    cookies.set(cookie.slice(0, i), cookie.slice(i + 1));
  }
  return response;
}
async function login(email: string, password: string, turnstileToken: string) {
  const csrf = await (await request("/api/auth/csrf")).json() as { csrfToken: string };
  const response = await request("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
    body: new URLSearchParams({ email, password, turnstileToken, csrfToken: csrf.csrfToken, callbackUrl: new URL("/dashboard", base).href }) });
  return new URL((await response.json() as { url: string }).url);
}
async function main() {
  assert.equal(process.env.RUN_LIVE_AUTH_REGRESSION, "I_UNDERSTAND_THIS_WRITES_TEST_DATA");
  assert.ok(process.env.TEST_BASE_URL && process.env.TEST_STAGING_ORIGIN && process.env.DATABASE_URL);
  assert.ok(!process.env.NODE_OPTIONS?.includes("tests/fixtures"), "Never preload fixtures for a live test");
  assert.ok(!process.env.TEST_ISOLATED_AUTH && !process.env.TEST_DATABASE_ADAPTER && !process.env.TURNSTILE_TEST_PROVIDER);
  base = new URL(process.env.TEST_BASE_URL);
  assert.equal(base.origin, process.env.TEST_STAGING_ORIGIN);
  assert.ok(base.protocol === "https:" || ["localhost", "127.0.0.1"].includes(base.hostname));
  assert.ok(!base.username && !base.password);
  const tokens = ["TEST_REGISTER_TURNSTILE_TOKEN", "TEST_UNKNOWN_LOGIN_TOKEN", "TEST_WRONG_PASSWORD_TOKEN", "TEST_UNVERIFIED_LOGIN_TOKEN", "TEST_LOGIN_TURNSTILE_TOKEN"].map((key) => process.env[key]);
  assert.ok(tokens.every((token) => token && !token.startsWith("fixture:")));
  assert.equal(new Set(tokens).size, 5, "Five fresh, distinct challenge tokens required");
  const [registerToken, unknownToken, wrongToken, unverifiedToken, goodToken] = tokens as [string, string, string, string, string];
  const email = `auth-regression-${randomUUID()}@example.invalid`;
  const password = `Chosen-${randomBytes(20).toString("hex")}!`;

  stage = "registration API";
  const registered = await request("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Staging Auth Regression", email, password, turnstileToken: registerToken }) });
  assert.equal(registered.status, 201);
  const body = await registered.json() as { data: { id: string; source: string; password?: string } };
  assert.equal(body.data.source, "database");
  assert.equal(body.data.password, undefined);

  stage = "independent database read";
  const row = await requireDatabase((db) => db.user.findFirst({ where: { email } })) as { id: string; password: string; emailVerified: Date | null; deletedAt: Date | null } | null;
  assert.ok(row, "API success must correspond to a real stored User in the SAME staging database");
  assert.equal(row.id, body.data.id);
  assert.equal(row.deletedAt, null);
  assert.equal(await compare(password, row.password), true);

  stage = "unknown email and wrong password";
  for (const [address, pass, token] of [[`missing-${randomUUID()}@example.invalid`, password, unknownToken], [email, "wrong-password", wrongToken]]) {
    const failed = await login(address!, pass!, token!);
    assert.equal(failed.searchParams.get("code"), "invalid-credentials");
    assert.equal(await (await request("/api/auth/session")).json(), null);
  }
  stage = "unverified customer login blocked";
  assert.equal((await login(email, password, unverifiedToken)).searchParams.get("code"), "email-not-verified");
  assert.equal(await (await request("/api/auth/session")).json(), null);
  assert.equal((await request("/checkout")).status, 200);

  stage = "email verification route";
  // Authorized staging DB access rotates a token without logging it; this does not test inbox delivery.
  const link = await prepareVerificationResend(email);
  assert.ok(link);
  const verified = await request(`/api/auth/verify-email?token=${link.token}`);
  assert.equal(new URL(verified.headers.get("location")!, base).pathname, "/auth/verification-success");
  const persisted = await requireDatabase((db) => db.user.findUnique({ where: { id: row.id }, select: { emailVerified: true } })) as { emailVerified: Date | null };
  assert.ok(persisted.emailVerified instanceof Date);

  stage = "verified Credentials login";
  assert.equal((await login(email, password, goodToken)).searchParams.get("error"), null);
  const session = await (await request("/api/auth/session")).json() as { user: { id: string; emailVerified: boolean } };
  assert.equal(session.user.id, row.id);
  assert.equal(session.user.emailVerified, true);

  if (process.env.TEST_CREATE_STAGING_ORDER === "true") {
    stage = "cart and checkout";
    const catalogue = await (await request("/api/products")).json() as { data: Product[] };
    const product = catalogue.data.find((item) => item.variants?.some((variant) => variant.stock > 0) || (!item.variants?.length && item.stock > 0));
    assert.ok(product);
    const variant = product.variants?.find((entry) => entry.stock > 0);
    const color = variant?.color ?? product.colors[0]!;
    const size = variant?.size ?? product.sizes[0]!;
    const storage = new Map<string, string>();
    Object.assign(globalThis, { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } });
    const { useCartStore } = await import("../store/useCartStore");
    useCartStore.getState().addItem(product, 1, { color, size });
    assert.equal(useCartStore.getState().itemCount, 1);
    const ordered = await request("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      items: useCartStore.getState().items,
      contact: { name: "Staging Auth Regression", email, phone: "01700000000" },
      shipping: { address: "Authorized staging test only", city: "Khulna", state: "Khulna Division", zip: "9204", country: "Bangladesh", method: "standard", giftWrap: false, saveAddress: false }, payment: { method: "COD" },
    }) });
    assert.equal(ordered.status, 201);
    const order = await ordered.json() as { data: { id: string } };
    stage = "independent order database read";
    const saved = await requireDatabase((db) => db.order.findUnique({ where: { id: order.data.id }, select: { id: true, userId: true } })) as { id: string; userId: string } | null;
    assert.equal(saved?.userId, row.id);
    useCartStore.getState().clearCart();
  }
  process.stdout.write(`PASS: live registration → independent DB read → credential negative cases → unverified login denied → email verification → verified login${process.env.TEST_CREATE_STAGING_ORDER === "true" ? " → cart/checkout → independent order DB read" : "; order test NOT enabled"}. Test records intentionally retained for authorized inspection/cleanup. No inbox or browser-visual claim.\n`);
}
main().catch(() => {
  console.error(`FAIL: authorized live auth regression at ${stage}. Check private configuration/provider/DB diagnostics; tokens, credentials and response bodies are intentionally not printed.`);
  process.exitCode = 1;
}).finally(async () => {
  if (stage === "configuration") return;
  try { await (await getPrisma())?.$disconnect?.(); } catch { /* Do not expose connection failures. */ }
});
