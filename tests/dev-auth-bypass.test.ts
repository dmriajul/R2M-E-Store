/**
 * End-to-end Credentials contract for the development-only CAPTCHA bypass.
 *
 * Runs the real Auth.js handlers against the isolated test database with
 * NODE_ENV=development and NO Turnstile token/secret. This is the exact local
 * login path: correct staff credentials must create a SUPER_ADMIN session;
 * wrong credentials must fail with `invalid-credentials`, never a CAPTCHA error.
 */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { installTestDatabase } from "./support/test-database";

const env = { ...process.env };
const scope = globalThis as typeof globalThis & { prisma?: unknown; prismaUnavailable?: boolean };
afterEach(() => {
  process.env = { ...env };
  delete scope.prisma;
  delete scope.prismaUnavailable;
});

test("development Credentials: no Turnstile token logs a Super Admin in; wrong password is invalid-credentials", async (context) => {
  context.mock.method(console, "warn", () => {});
  context.mock.method(console, "error", () => {});
  process.env = {
    ...process.env,
    NODE_ENV: "development",
    AUTH_SECRET: "development-bypass-test-secret",
    AUTH_URL: "http://localhost:3000",
    NEXTAUTH_URL: "http://localhost:3000",
  };
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;

  const fixture = installTestDatabase({
    user: [{
      id: "dev-super-admin",
      name: "Dev Super Admin",
      email: "admin@mukra.com",
      password: await hash("password123", 10),
      role: "SUPER_ADMIN",
      deletedAt: null,
      emailVerified: null,
    }],
  });
  Object.assign(globalThis, { prisma: fixture.db });

  const { handlers } = await import("../lib/auth");
  const csrfResponse = await handlers.GET(new NextRequest("http://localhost:3000/api/auth/csrf"));
  const csrf = await csrfResponse.json() as { csrfToken: string };
  const csrfCookies = csrfResponse.headers.getSetCookie().map((header) => header.split(";")[0]).join("; ");
  assert.ok(csrf.csrfToken);

  async function credentials(password: string) {
    return handlers.POST(new NextRequest("http://localhost:3000/api/auth/callback/credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
        cookie: csrfCookies,
      },
      body: new URLSearchParams({
        email: "admin@mukra.com",
        password,
        csrfToken: csrf.csrfToken,
        callbackUrl: "http://localhost:3000/admin",
      }).toString(),
    }));
  }

  const success = await credentials("password123");
  const destination = await success.json() as { url: string };
  assert.equal(new URL(destination.url).searchParams.get("error"), null, "No CAPTCHA error may block local login");
  assert.equal(new URL(destination.url).pathname, "/admin");

  const sessionCookies = success.headers.getSetCookie().map((header) => header.split(";")[0]).join("; ");
  const sessionResponse = await handlers.GET(new NextRequest("http://localhost:3000/api/auth/session", {
    headers: { cookie: `${csrfCookies}; ${sessionCookies}` },
  }));
  const session = await sessionResponse.json() as { user?: { email?: string; role?: string } } | null;
  assert.equal(session?.user?.email, "admin@mukra.com");
  assert.equal(session?.user?.role, "SUPER_ADMIN");

  const wrong = await credentials("wrong-password");
  const wrongDestination = await wrong.json() as { url: string };
  assert.equal(new URL(wrongDestination.url).searchParams.get("code"), "invalid-credentials");
  assert.equal(new URL(wrongDestination.url).searchParams.get("error"), "CredentialsSignin");
});
