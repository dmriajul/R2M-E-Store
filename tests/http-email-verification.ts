/** Isolated DEVELOPMENT demo only. Never point this at real accounts or production logs. */
import assert from "node:assert/strict";
import { fixtureToken } from "./turnstile-http-token";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const logPath = process.env.VERIFICATION_TEST_LOG;
const cookies = new Map<string, string>();
async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
  const response = await fetch(new URL(path, base), { ...options, headers, redirect: "manual" });
  for (const entry of response.headers.getSetCookie()) {
    const cookie = entry.split(";")[0]!;
    const index = cookie.indexOf("=");
    cookies.set(cookie.slice(0, index), cookie.slice(index + 1));
  }
  return response;
}
async function loggedLinks() {
  assert.ok(logPath, "Set VERIFICATION_TEST_LOG to the isolated dev server's local-only log file");
  const text = await readFile(logPath, "utf8");
  return [...text.matchAll(/\[verification:local-only\]\s+(https?:\/\/[^\s]+)/g)].map(
    (match) => match[1]!,
  );
}
async function waitForLinkCount(minimum: number) {
  // Wait for a deferred after() side effect, not for server startup.
  for (let index = 0; index < 50; index++) {
    const links = await loggedLinks();
    if (links.length >= minimum) return links;
    await setTimeout(100);
  }
  throw new Error("Deferred local verification email was not logged");
}
async function expectRedirect(link: string, path: string) {
  const response = await request(link);
  assert.equal(response.status, 303);
  assert.equal(new URL(response.headers.get("location")!, base).pathname, path);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.ok(response.headers.get("cache-control")?.includes("no-store"));
}
async function main() {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local testing only");
  assert.equal(process.env.TEST_DATABASE_ADAPTER, "isolated", "External test database fixture required");
  const health = (await (await request("/api/health")).json()) as { data: { mode: string } };
  assert.equal(health.data.mode, "live", "Fixture must use the configured-database path");
  const before = (await loggedLinks()).length;
  const email = `verification-http-${crypto.randomUUID()}@example.com`;
  const password = "ChosenHttpPass123!";
  const registered = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name: "Verification HTTP", password, turnstileToken: fixtureToken("register") }),
  });
  assert.equal(registered.status, 201);
  const body = (await registered.json()) as {
    data: { emailVerified: null; redirectTo: string; token?: string };
  };
  assert.equal(body.data.emailVerified, null);
  assert.equal(body.data.token, undefined);
  assert.equal(body.data.redirectTo, "/auth/verify-email-pending");
  assert.equal(await (await request("/api/auth/session")).json(), null);
  const initial = (await waitForLinkCount(before + 1)).at(-1)!;

  const csrf = (await (await request("/api/auth/csrf")).json()) as { csrfToken: string };
  const deniedLogin = await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      turnstileToken: fixtureToken("login"),
      email,
      password,
      callbackUrl: new URL("/checkout", base).href,
    }),
  });
  const denied = await deniedLogin.json() as { url: string };
  assert.equal(new URL(denied.url).searchParams.get("code"), "email-not-verified");
  assert.equal(await (await request("/api/auth/session")).json(), null);
  assert.equal((await request("/checkout")).status, 200, "Checkout page stays public; order placement retains its existing authentication requirement");

  await request("/auth/verify-email-pending"); // Ensure the action is compiled in dev.
  const manifest = JSON.parse(
    await readFile(".next/server/server-reference-manifest.json", "utf8"),
  ) as {
    node: Record<string, { exportedName?: string; workers: Record<string, unknown> }>;
  };
  const action = Object.entries(manifest.node).find(
    ([, value]) =>
      value.exportedName === "resendVerificationEmail" ||
      Object.keys(value.workers).some((worker) => worker.includes("auth/verify-email-pending")),
  );
  assert.ok(action, "Resend Server Action must be in the current build manifest");
  async function resend(address: string) {
    const response = await request("/auth/verify-email-pending", {
      method: "POST",
      headers: {
        "Next-Action": action![0],
        Origin: new URL(base).origin,
        "Content-Type": "text/plain;charset=UTF-8",
        Accept: "text/x-component",
      },
      body: JSON.stringify([{ email: address, turnstileToken: fixtureToken("resend_verification") }]),
    });
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.ok(
      text.includes("If this account needs verification"),
      "Response must not disclose account status",
    );
  }
  for (let index = 1; index <= 3; index++) {
    await resend(email);
    await waitForLinkCount(before + 1 + index);
  }
  const links = await loggedLinks();
  const latest = links.at(-1)!;
  assert.notEqual(latest, initial);
  await resend(email); // Fourth resend suppressed, but outward response stays generic.
  await resend("unknown-verification@example.com");
  assert.equal((await loggedLinks()).length, before + 4);
  await expectRedirect(initial, "/auth/verification-error");
  await expectRedirect(latest, "/auth/verification-success");
  await expectRedirect(latest, "/auth/verification-error");
  const verifiedCsrf = await (await request("/api/auth/csrf")).json() as { csrfToken: string };
  const signedIn = await request("/api/auth/callback/credentials", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
    body: new URLSearchParams({ email, password, csrfToken: verifiedCsrf.csrfToken, turnstileToken: fixtureToken("login"), callbackUrl: new URL("/dashboard", base).href }),
  });
  assert.equal(new URL((await signedIn.json() as { url: string }).url).searchParams.get("error"), null);
  const verified = (await (await request("/api/auth/session")).json()) as {
    user: { emailVerified: boolean };
  };
  assert.equal(
    verified.user.emailVerified,
    true,
    "Verified customer can now sign in",
  );
  await resend(email); // Verified user also receives the same generic response, no email.
  assert.equal((await loggedLinks()).length, before + 4);
  process.stdout.write(
    "PASS: HTTP registration → deferred email → real resend Server Action (3/hour) → rotation → verify → replay rejection → verified login/session. Test-only database contract adapter; no live DB/delivery claim.\n",
  );
}
main().catch(() => {
  // Do not print assertions/URLs from this bearer-link test into shared output.
  console.error(
    "Email verification HTTP test failed. Inspect the isolated server locally; no bearer links are printed by this test.",
  );
  process.exitCode = 1;
});
