import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { JSDOM } from "jsdom";
import { act, createElement, StrictMode, type ComponentType } from "react";
import type * as ReactDOMClient from "react-dom/client";
import { toast } from "sonner";
import { installTestDatabase } from "./support/test-database";
import { authConfig } from "../lib/auth.config";

const originalEnv = { ...process.env };
const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  url: "http://localhost:3000/dashboard",
  pretendToBeVisual: true,
});

let createRoot: typeof ReactDOMClient.createRoot;

before(async () => {
  Object.assign(globalThis, {
    window: dom.window,
    self: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    Element: dom.window.Element,
    SVGElement: dom.window.SVGElement,
    MutationObserver: dom.window.MutationObserver,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.assign(dom.window, {
    matchMedia: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  ({ createRoot } = await import("react-dom/client"));
});

after(() => {
  process.env = { ...originalEnv };
  dom.window.close();
});

async function mountComponent(component: ComponentType) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(StrictMode, null, createElement(component)));
  });
  return {
    container,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

let shellSeq = 0;

test("EP-1: Dashboard LogoutButton waits for Auth.js signOut to complete before clearing identity caches, showing success toast, or navigating", async (context) => {
  const navCalls: string[] = [];
  const toastCalls: Array<{ kind: string; message: string }> = [];
  let signOutCalls = 0;
  let resolveSignOut!: (value: { url: string }) => void;

  context.mock.module("next/navigation", {
    namedExports: {
      useRouter: () => ({
        push: (href: string) => navCalls.push(`push:${href}`),
        replace: (href: string) => navCalls.push(`replace:${href}`),
        refresh: () => navCalls.push("refresh"),
      }),
      usePathname: () => "/dashboard",
    },
  });

  context.mock.module("next-auth/react", {
    namedExports: {
      signOut: (opts?: { redirect?: boolean; callbackUrl?: string }) => {
        signOutCalls += 1;
        assert.equal(opts?.redirect, false);
        assert.equal(opts?.callbackUrl, "/");
        return new Promise<{ url: string }>((resolve) => {
          resolveSignOut = resolve;
        });
      },
    },
  });

  context.mock.method(toast, "success", ((msg: unknown) => {
    toastCalls.push({ kind: "success", message: String(msg) });
    return "toast-id";
  }) as typeof toast.success);
  context.mock.method(toast, "info", ((msg: unknown) => {
    toastCalls.push({ kind: "info", message: String(msg) });
    return "toast-id";
  }) as typeof toast.info);
  context.mock.method(toast, "error", ((msg: unknown) => {
    toastCalls.push({ kind: "error", message: String(msg) });
    return "toast-id";
  }) as typeof toast.error);

  const { useCheckoutStore } = await import("../store/useCheckoutStore");
  const { useDashboardStore } = await import("../store/useDashboardStore");
  const { useWishlistStore } = await import("../store/useWishlistStore");

  useCheckoutStore.setState({
    contact: { email: "shopper@example.com", phone: "01700000000", marketingOptIn: false },
  });
  useDashboardStore.getState().applyIdentity({
    id: "shopper-1",
    name: "Shopper",
    email: "shopper@example.com",
    phone: "01700000000",
  });
  useWishlistStore.getState().add("prod-1");

  const mod = await import(`../components/dashboard/DashboardShell?bust=${++shellSeq}`);
  let doneCalled = 0;
  const view = await mountComponent(() =>
    createElement(mod.LogoutButton, {
      onDone: () => {
        doneCalled += 1;
      },
    }),
  );

  try {
    const button = view.container.querySelector("button")!;
    assert.ok(button);
    assert.equal(button.textContent, "Logout");
    assert.equal(button.disabled, false);

    // Click Logout: signOut starts, but has NOT resolved yet.
    await act(async () => {
      button.click();
    });

    assert.equal(signOutCalls, 1);
    assert.equal(button.disabled, true);
    assert.equal(button.getAttribute("aria-busy"), "true");
    assert.equal(button.textContent, "Signing out…");

    // Must NOT show success toast, clear identity caches, or navigate before signOut completes!
    assert.equal(toastCalls.length, 0);
    assert.equal(navCalls.length, 0);
    assert.equal(doneCalled, 0);
    assert.equal(useCheckoutStore.getState().contact?.email, "shopper@example.com");
    assert.equal(useDashboardStore.getState().identity?.id, "shopper-1");
    assert.deepEqual(useWishlistStore.getState().ids, ["prod-1"]);

    // Clicking again while in-flight cannot trigger duplicate signOut requests
    await act(async () => {
      button.click();
    });
    assert.equal(signOutCalls, 1);

    // Resolve Auth.js signOut -> caches cleared, toast shown, history replaced & refreshed
    await act(async () => {
      resolveSignOut({ url: "http://localhost:3000/" });
      await Promise.resolve();
    });

    assert.equal(useCheckoutStore.getState().contact, null);
    assert.equal(useDashboardStore.getState().identity, null);
    assert.deepEqual(useWishlistStore.getState().ids, []);
    assert.equal(doneCalled, 1);
    assert.equal(toastCalls.length, 1);
    assert.equal(toastCalls[0]?.kind, "success");
    assert.deepEqual(navCalls, ["replace:/", "refresh"]);
  } finally {
    await view.unmount();
  }
});

test("EP-1: Dashboard LogoutButton handles failed signOut without showing false success or navigating", async (context) => {
  const navCalls: string[] = [];
  const toastCalls: Array<{ kind: string; message: string }> = [];

  context.mock.module("next/navigation", {
    namedExports: {
      useRouter: () => ({
        push: (href: string) => navCalls.push(`push:${href}`),
        replace: (href: string) => navCalls.push(`replace:${href}`),
        refresh: () => navCalls.push("refresh"),
      }),
      usePathname: () => "/dashboard",
    },
  });

  context.mock.module("next-auth/react", {
    namedExports: {
      signOut: async () => {
        throw new Error("network failure");
      },
    },
  });

  context.mock.method(toast, "success", ((msg: unknown) => {
    toastCalls.push({ kind: "success", message: String(msg) });
    return "toast-id";
  }) as typeof toast.success);
  context.mock.method(toast, "info", ((msg: unknown) => {
    toastCalls.push({ kind: "info", message: String(msg) });
    return "toast-id";
  }) as typeof toast.info);
  context.mock.method(toast, "error", ((msg: unknown) => {
    toastCalls.push({ kind: "error", message: String(msg) });
    return "toast-id";
  }) as typeof toast.error);

  const mod = await import(`../components/dashboard/DashboardShell?bust=${++shellSeq}`);
  const view = await mountComponent(() => createElement(mod.LogoutButton));

  try {
    const button = view.container.querySelector("button")!;
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    assert.equal(toastCalls.some((entry) => entry.kind === "success" || entry.kind === "info"), false);
    assert.equal(toastCalls.some((entry) => entry.kind === "error"), true);
    assert.equal(navCalls.length, 0);
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, "Logout");
  } finally {
    await view.unmount();
  }
});

test("EP-1: Auth.js signout terminates the server session cookie so protected /dashboard routes deny subsequent access", async (context) => {
  context.mock.method(console, "warn", () => {});
  context.mock.method(console, "error", () => {});

  process.env = {
    ...originalEnv,
    NODE_ENV: "development",
    AUTH_SECRET: "ep1-dashboard-logout-test-secret-32chars",
    AUTH_URL: "http://localhost:3000",
    NEXTAUTH_URL: "http://localhost:3000",
    TURNSTILE_SECRET_KEY: "ep1-turnstile-secret",
  };
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({ success: true, action: "login", hostname: "localhost" }),
  );

  const fixture = installTestDatabase({
    user: [
      {
        id: "ep1-customer",
        name: "Shopper",
        email: "shopper@example.com",
        password: await hash("SecretPass123!", 10),
        role: "CUSTOMER",
        deletedAt: null,
        emailVerified: new Date(),
      },
    ],
  });
  Object.assign(globalThis, { prisma: fixture.db });

  const { handlers } = await import("../lib/auth");

  // 1. Obtain CSRF token & sign in
  const csrfRes = await handlers.GET(new NextRequest("http://localhost:3000/api/auth/csrf"));
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookie = csrfRes.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");

  const loginRes = await handlers.POST(
    new NextRequest("http://localhost:3000/api/auth/callback/credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
        cookie: csrfCookie,
      },
      body: new URLSearchParams({
        email: "shopper@example.com",
        password: "SecretPass123!",
        "cf-turnstile-response": "solved-token",
        csrfToken,
        callbackUrl: "http://localhost:3000/dashboard",
      }).toString(),
    }),
  );
  const sessionCookie = loginRes.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");

  const activeSessionRes = await handlers.GET(
    new NextRequest("http://localhost:3000/api/auth/session", {
      headers: { cookie: `${csrfCookie}; ${sessionCookie}` },
    }),
  );
  const activeSession = (await activeSessionRes.json()) as { user?: { id: string; role: string } } | null;
  assert.equal(activeSession?.user?.id, "ep1-customer");

  // 2. Sign out via Auth.js POST /api/auth/signout (exact endpoint called by signOut({ redirect: false }))
  const signOutRes = await handlers.POST(
    new NextRequest("http://localhost:3000/api/auth/signout", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
        cookie: `${csrfCookie}; ${sessionCookie}`,
      },
      body: new URLSearchParams({
        csrfToken,
        callbackUrl: "http://localhost:3000/",
      }).toString(),
    }),
  );
  assert.equal(signOutRes.status, 200);
  const signOutPayload = (await signOutRes.json()) as { url?: string };
  assert.equal(signOutPayload.url, "http://localhost:3000/");

  const clearedCookies = signOutRes.headers.getSetCookie();
  assert.ok(
    clearedCookies.some(
      (header) => header.includes("session-token=") && (header.includes("Max-Age=0") || header.includes("Expires=Thu, 01 Jan 1970")),
    ),
    "Sign-out must clear the Auth.js session-token cookie",
  );

  // Apply Set-Cookie jar update as browser does (cleared session-token -> empty)
  const postLogoutCookie = clearedCookies
    .filter((header) => !header.includes("Max-Age=0") && !header.includes("Expires=Thu, 01 Jan 1970"))
    .map((header) => header.split(";")[0])
    .join("; ");

  const afterSessionRes = await handlers.GET(
    new NextRequest("http://localhost:3000/api/auth/session", {
      headers: { cookie: `${csrfCookie}${postLogoutCookie ? `; ${postLogoutCookie}` : ""}` },
    }),
  );
  const afterSession = await afterSessionRes.json();
  assert.equal(afterSession, null);

  // Middleware authorization denies /dashboard once session is null
  const dashboardAllowed = await authConfig.callbacks.authorized({
    auth: afterSession,
    request: { nextUrl: new URL("http://localhost:3000/dashboard") },
  } as Parameters<typeof authConfig.callbacks.authorized>[0]);
  assert.equal(dashboardAllowed, false);
});
