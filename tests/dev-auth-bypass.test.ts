/** Real development Credentials contract: CAPTCHA remains enforced. */
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

test("development Credentials: missing CAPTCHA fails closed; solved challenge allows login", async (context) => {
  context.mock.method(console, "warn", () => {});
  context.mock.method(console, "error", () => {});
  process.env = {
    ...process.env,
    NODE_ENV: "development",
    AUTH_SECRET: "development-bypass-test-secret",
    AUTH_URL: "http://localhost:3000",
    NEXTAUTH_URL: "http://localhost:3000",
  };
  process.env.TURNSTILE_SECRET_KEY = "isolated-unit-test-secret";
  context.mock.method(globalThis, "fetch", async () => Response.json({ success: true, action: "login", hostname: "localhost" }));
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

  async function credentials(password: string, token = "solved-unit-token") {
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
        turnstileToken: token,
        csrfToken: csrf.csrfToken,
        callbackUrl: "http://localhost:3000/admin",
      }).toString(),
    }));
  }

  const blocked = await credentials("password123", "");
  assert.equal(new URL((await blocked.json()).url).searchParams.get("code"), "security-verification-failed");
  const success = await credentials("password123");
  const destination = await success.json() as { url: string };
  assert.equal(new URL(destination.url).searchParams.get("error"), null, "A verified challenge permits credential verification");
  assert.equal(new URL(destination.url).pathname, "/admin");

  const sessionCookies = success.headers.getSetCookie().map((header) => header.split(";")[0]).join("; ");
  const sessionResponse = await handlers.GET(new NextRequest("http://localhost:3000/api/auth/session", {
    headers: { cookie: `${csrfCookies}; ${sessionCookies}` },
  }));
  const session = await sessionResponse.json() as { user?: { email?: string; role?: string } } | null;
  assert.equal(session?.user?.email, "admin@mukra.com");
  assert.equal(session?.user?.role, "SUPER_ADMIN");

  async function credentialsCfResponse(password: string, cfToken: string) {
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
        "cf-turnstile-response": cfToken,
        csrfToken: csrf.csrfToken,
        callbackUrl: "http://localhost:3000/admin",
      }).toString(),
    }));
  }

  const cfSuccess = await credentialsCfResponse("password123", "solved-cf-turnstile-response-token");
  const cfDestination = await cfSuccess.json() as { url: string };
  assert.equal(new URL(cfDestination.url).searchParams.get("error"), null, "cf-turnstile-response alone authenticates Credentials");
  assert.equal(new URL(cfDestination.url).pathname, "/admin");

  const wrong = await credentials("wrong-password");
  const wrongDestination = await wrong.json() as { url: string };
  assert.equal(new URL(wrongDestination.url).searchParams.get("code"), "invalid-credentials");
  assert.equal(new URL(wrongDestination.url).searchParams.get("error"), "CredentialsSignin");
});

test("production Vercel handshake: riajul@mukra.com (SUPER_ADMIN) and verified customer sign in smoothly with cf-turnstile-response across NextAuth Credentials and /api/auth/login", async (context) => {
  context.mock.method(console, "warn", () => {});
  const errorLogs: string[] = [];
  context.mock.method(console, "error", (...args: unknown[]) => {
    errorLogs.push(args.map(String).join(" "));
  });

  process.env = {
    ...process.env,
    NODE_ENV: "production",
    VERCEL: "1",
    VERCEL_ENV: "production",
    AUTH_SECRET: "production-handshake-test-auth-secret-32chars",
    AUTH_URL: "https://2r-m-store.vercel.app",
    NEXTAUTH_URL: "https://2r-m-store.vercel.app",
    NEXT_PUBLIC_SITE_URL: "https://2r-m-store.vercel.app",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: ' "0x4AAAAAAFR9W3cd66AOTr2B" ',
    TURNSTILE_SECRET_KEY: ' "0x4AAAAAA_prod_verified_secret_35ch" \n',
  };
  delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;

  const adminPassword = "MukraAdminStrong#2026";
  const customerPassword = "MukraShopperStrong#2026";
  const fixture = installTestDatabase({
    user: [
      {
        id: "prod-riajul-admin",
        name: "Riajul Khandokar",
        email: "riajul@mukra.com",
        password: await hash(adminPassword, 10),
        role: "SUPER_ADMIN",
        deletedAt: null,
        emailVerified: null,
      },
      {
        id: "prod-verified-customer",
        name: "Verified Shopper",
        email: "shopper@mukra.com",
        password: await hash(customerPassword, 10),
        role: "CUSTOMER",
        deletedAt: null,
        emailVerified: new Date("2026-10-20T00:00:00.000Z"),
      },
    ],
  });
  Object.assign(globalThis, { prisma: fixture.db });

  const verifiedRequests: Array<{ secret: string; response: string; remoteip: string | null }> = [];
  context.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    const params = new URLSearchParams(String(init?.body ?? ""));
    const token = params.get("response") ?? "";
    verifiedRequests.push({
      secret: params.get("secret") ?? "",
      response: token,
      remoteip: params.get("remoteip"),
    });
    if (token === "expired-cf-token") {
      return Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] });
    }
    return Response.json({
      success: true,
      action: "login",
      hostname: "2r-m-store.vercel.app",
    });
  });

  const { handlers } = await import("../lib/auth");
  const { POST: loginApiPost } = await import("../app/api/auth/login/route");

  // 1. NextAuth Credentials handshake for riajul@mukra.com on https://2r-m-store.vercel.app
  const csrfResp = await handlers.GET(
    new NextRequest("https://2r-m-store.vercel.app/api/auth/csrf", {
      headers: { "x-forwarded-host": "2r-m-store.vercel.app", "x-forwarded-proto": "https" },
    }),
  );
  const csrf = (await csrfResp.json()) as { csrfToken: string };
  const csrfCookie = csrfResp.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");

  const adminSignIn = await handlers.POST(
    new NextRequest("https://2r-m-store.vercel.app/api/auth/callback/credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
        "x-forwarded-for": "203.0.113.10",
        "x-forwarded-host": "2r-m-store.vercel.app",
        "x-forwarded-proto": "https",
        cookie: csrfCookie,
      },
      body: new URLSearchParams({
        email: "  Riajul@Mukra.com ",
        password: adminPassword,
        "cf-turnstile-response": "cf-prod-admin-token",
        csrfToken: csrf.csrfToken,
        callbackUrl: "https://2r-m-store.vercel.app/admin",
      }).toString(),
    }),
  );
  const adminRedirect = new URL(((await adminSignIn.json()) as { url: string }).url);
  assert.equal(adminRedirect.searchParams.get("error"), null);
  assert.equal(adminRedirect.pathname, "/admin");
  assert.equal(verifiedRequests.at(-1)?.secret, "0x4AAAAAA_prod_verified_secret_35ch");
  assert.equal(verifiedRequests.at(-1)?.response, "cf-prod-admin-token");
  assert.equal(verifiedRequests.at(-1)?.remoteip, "203.0.113.10");

  const sessionCookie = adminSignIn.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  const adminSessionResp = await handlers.GET(
    new NextRequest("https://2r-m-store.vercel.app/api/auth/session", {
      headers: {
        "x-forwarded-host": "2r-m-store.vercel.app",
        "x-forwarded-proto": "https",
        cookie: `${csrfCookie}; ${sessionCookie}`,
      },
    }),
  );
  const adminSession = (await adminSessionResp.json()) as {
    user?: { email?: string; role?: string; name?: string };
  } | null;
  assert.equal(adminSession?.user?.email, "riajul@mukra.com");
  assert.equal(adminSession?.user?.role, "SUPER_ADMIN");

  // 2. /api/auth/login preflight route handshake for riajul@mukra.com and verified customer
  const adminApiLogin = await loginApiPost(
    new NextRequest("https://2r-m-store.vercel.app/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.11",
        "x-forwarded-host": "2r-m-store.vercel.app",
      },
      body: JSON.stringify({
        email: "riajul@mukra.com",
        password: adminPassword,
        "cf-turnstile-response": "cf-api-admin-token",
      }),
    }),
  );
  assert.equal(adminApiLogin.status, 200);
  const adminApiJson = (await adminApiLogin.json()) as {
    success: boolean;
    data: { email: string; role: string } | null;
  };
  assert.equal(adminApiJson.success, true);
  assert.equal(adminApiJson.data?.email, "riajul@mukra.com");

  const customerSignIn = await handlers.POST(
    new NextRequest("https://2r-m-store.vercel.app/api/auth/callback/credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
        "x-forwarded-for": "203.0.113.12",
        "x-forwarded-host": "2r-m-store.vercel.app",
        "x-forwarded-proto": "https",
        cookie: csrfCookie,
      },
      body: new URLSearchParams({
        email: "shopper@mukra.com",
        password: customerPassword,
        "cf-turnstile-response": "cf-prod-customer-token",
        csrfToken: csrf.csrfToken,
        callbackUrl: "https://2r-m-store.vercel.app/dashboard",
      }).toString(),
    }),
  );
  const customerRedirect = new URL(((await customerSignIn.json()) as { url: string }).url);
  assert.equal(customerRedirect.searchParams.get("error"), null);
  assert.equal(customerRedirect.pathname, "/dashboard");

  // 3. Fail-closed handshake with detailed runtime log when Cloudflare rejects a replay/expired token
  errorLogs.length = 0;
  const replaySignIn = await handlers.POST(
    new NextRequest("https://2r-m-store.vercel.app/api/auth/callback/credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
        "x-forwarded-for": "203.0.113.13",
        "x-forwarded-host": "2r-m-store.vercel.app",
        "x-forwarded-proto": "https",
        cookie: csrfCookie,
      },
      body: new URLSearchParams({
        email: "riajul@mukra.com",
        password: adminPassword,
        "cf-turnstile-response": "expired-cf-token",
        csrfToken: csrf.csrfToken,
        callbackUrl: "https://2r-m-store.vercel.app/admin",
      }).toString(),
    }),
  );
  const replayRedirect = new URL(((await replaySignIn.json()) as { url: string }).url);
  assert.equal(replayRedirect.searchParams.get("code"), "security-verification-failed");
  assert.ok(errorLogs.some((line) => line.includes("timeout-or-duplicate")));
  assert.ok(errorLogs.some((line) => line.includes("[auth] Credentials Turnstile verification failed")));
});
