import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement, StrictMode, type ComponentType } from "react";
import type * as NextAuthReact from "next-auth/react";
import type * as ReactDOMClient from "react-dom/client";
import { authConfig } from "../lib/auth.config";
import { safeCallbackPath } from "../lib/auth-redirect";
import type { Product } from "../types";

// Prevent next-auth/react's singleton BroadcastChannel from holding Node's event loop open after tests finish.
class MockBroadcastChannel {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  postMessage() {}
  addEventListener() {}
  removeEventListener() {}
  close() {}
}
Object.assign(globalThis, { BroadcastChannel: MockBroadcastChannel });

const originalEnv = { ...process.env };
const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  url: "http://localhost:3000/checkout",
  pretendToBeVisual: true,
});

type CaptchaOptions = {
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};
const widgets = new Map<string, CaptchaOptions>();
let widgetSeq = 0;
let createRoot: typeof ReactDOMClient.createRoot;

before(async () => {
  Object.assign(globalThis, {
    window: dom.window,
    self: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
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
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }),
    turnstile: {
      render: (_el: HTMLElement, options: CaptchaOptions) => {
        const id = `checkout-redirect-widget-${++widgetSeq}`;
        widgets.set(id, options);
        return id;
      },
      remove: (id: string) => widgets.delete(id),
    },
  });
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "isolated-dom-key";
  ({ createRoot } = await import("react-dom/client"));
});

after(() => {
  process.env = { ...originalEnv };
  dom.window.close();
});

async function mount(component: ComponentType) {
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

const SAMPLE_PRODUCT: Product = {
  id: "checkout-persist-item",
  slug: "checkout-persist-item",
  name: "Golden Linen Dress",
  tagline: "Soft organic linen",
  description: "Soft organic linen dress",
  price: 1250,
  currency: "BDT",
  images: [],
  category: "Tops & Tees",
  categories: ["Tops & Tees"],
  ageRange: "3-6Y",
  gender: "Girls",
  colors: ["Gold"],
  sizes: ["4Y"],
  material: "Linen",
  tags: [],
  rating: 5,
  reviewCount: 0,
  stock: 8,
  inStock: true,
  variants: [{ color: "Gold", size: "4Y", stock: 8 }],
  featured: false,
  status: "active",
  createdAt: new Date().toISOString(),
};

let pageLoadSeq = 0;

test("checkout redirect: unauthenticated visitor to /checkout redirects to /login?callbackUrl=%2Fcheckout while authenticated customer renders CheckoutPage without redirect", async (context) => {
  let currentSession: { user?: { id: string; email: string; role: string } } | null = null;
  const redirects: string[] = [];

  class RedirectSignal extends Error {
    destination: string;
    constructor(destination: string) {
      super(`NEXT_REDIRECT:${destination}`);
      this.destination = destination;
    }
  }

  context.mock.module("../lib/auth", {
    namedExports: {
      auth: async () => currentSession,
    },
  });
  context.mock.module("next/navigation", {
    namedExports: {
      redirect: (url: string) => {
        redirects.push(url);
        throw new RedirectSignal(url);
      },
    },
  });

  const { default: CheckoutPage } = await import(
    `../app/(shop)/checkout/page?bust=${++pageLoadSeq}`
  );

  // 1. Edge middleware authorized() gate: unauthenticated /checkout -> 307 /login?callbackUrl=%2Fcheckout
  const middlewareGuest = await authConfig.callbacks.authorized({
    auth: null,
    request: { nextUrl: new URL("https://mukra.example/checkout") },
  } as Parameters<typeof authConfig.callbacks.authorized>[0]);
  assert.ok(middlewareGuest instanceof Response);
  assert.equal(middlewareGuest.status, 307);
  assert.equal(
    middlewareGuest.headers.get("location"),
    "https://mukra.example/login?callbackUrl=%2Fcheckout",
  );

  // Authenticated customer on /checkout passes middleware gate without redirect
  const middlewareAuth = await authConfig.callbacks.authorized({
    auth: { user: { id: "cust-1", role: "CUSTOMER" } },
    request: { nextUrl: new URL("https://mukra.example/checkout") },
  } as Parameters<typeof authConfig.callbacks.authorized>[0]);
  assert.equal(middlewareAuth, true);

  // 2. Server Component CheckoutPage gate: unauthenticated -> redirects to /login?callbackUrl=%2Fcheckout
  currentSession = null;
  await assert.rejects(
    async () => {
      await CheckoutPage();
    },
    (err: unknown) =>
      err instanceof RedirectSignal && err.destination === "/login?callbackUrl=%2Fcheckout",
  );
  assert.deepEqual(redirects, ["/login?callbackUrl=%2Fcheckout"]);

  // 3. Authenticated customer -> no redirect loop; returns CheckoutPage JSX tree
  redirects.length = 0;
  currentSession = {
    user: { id: "cust-1", email: "shopper@example.com", role: "CUSTOMER" },
  };
  const rendered = await CheckoutPage();
  assert.equal(redirects.length, 0);
  assert.ok(rendered);
});

test("callback URL validation: allows /checkout and blocks external origins, protocol-relative paths, backslash smuggling, and auth-route redirect loops", () => {
  const origin = "https://2r-m-store.vercel.app";

  // Valid checkout callback URLs (decoded from ?callbackUrl=%2Fcheckout or same-origin URL)
  assert.equal(safeCallbackPath("/checkout", origin), "/checkout");
  assert.equal(safeCallbackPath(`${origin}/checkout`, origin), "/checkout");
  assert.equal(safeCallbackPath("/checkout?step=2", origin), "/checkout?step=2");

  // External & open-redirect vectors must fall back safely to /dashboard
  for (const malicious of [
    "https://evil.example",
    "https://evil.example/checkout",
    "http://evil.example/checkout",
    "//evil.example",
    "//evil.example/checkout",
    "///evil.example/checkout",
    `${origin}//evil.example/phish`,
    `${origin}///evil.example/phish`,
    "/\\evil.example",
    "\\evil.example",
    "evil.example/checkout",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
  ]) {
    assert.equal(
      safeCallbackPath(malicious, origin),
      "/dashboard",
      `Expected ${malicious} to be blocked`,
    );
  }

  // Auth-page self-redirects (lowercase, uppercase, mixed-case, additional auth routes, and percent-encoded variants) must not loop
  for (const loopPath of [
    "/login",
    "/LOGIN",
    "/Login",
    "/login?callbackUrl=%2Fcheckout",
    "/LOGIN?callbackUrl=%2Fcheckout",
    `${origin}/Login?callbackUrl=%2Fcheckout`,
    "/register",
    "/REGISTER",
    "/Register",
    "/signup",
    "/SIGNUP",
    "/SignUp",
    "/forgot-password",
    "/FORGOT-PASSWORD",
    "/Forgot-Password?email=shopper%40example.com",
    "/reset-password",
    "/RESET-PASSWORD",
    "/Reset-Password/token-123",
    "/auth",
    "/AUTH",
    "/auth/verify-email-pending",
    "/AUTH/verification-error",
    "/Auth/Verification-Success",
    "/api/auth",
    "/API/AUTH",
    "/api/auth/signin",
    "/API/Auth/signin",
    "/api/auth/callback/credentials",
    "/%6cogin",
    "/%4cogin",
    "/api/%61uth/signin",
    "/%2f%2fevil.example",
    "/%5cevil.example",
  ]) {
    assert.equal(
      safeCallbackPath(loopPath, origin),
      "/dashboard",
      `Expected ${loopPath} to avoid auth redirect loop`,
    );
  }

  // Legitimate non-auth paths that merely share prefixes (e.g. /author-story) remain allowed
  assert.equal(safeCallbackPath("/author-story", origin), "/author-story");
  assert.equal(safeCallbackPath("/shop?category=dresses#grid", origin), "/shop?category=dresses#grid");
});

test("cart persistence + login return + empty-cart preservation: guest cart survives /checkout -> /login?callbackUrl=%2Fcheckout -> login -> /checkout, and empty cart still renders empty state", async (context) => {
  dom.window.localStorage.clear();
  dom.window.sessionStorage.clear();

  const requireModule = createRequire(import.meta.url);
  const { SessionProvider } = requireModule("next-auth/react") as typeof NextAuthReact;
  const { useCartStore } = await import("../store/useCartStore");
  const { clearIdentityCaches } = await import("../lib/session-cache");

  // 1. Guest adds items to cart (persisted in localStorage under "mukra-cart")
  useCartStore.getState().clearCart();
  useCartStore.getState().addItem(SAMPLE_PRODUCT, 2, { color: "Gold", size: "4Y" });
  assert.equal(useCartStore.getState().itemCount, 2);
  assert.equal(useCartStore.getState().total, 2500);
  const savedBeforeRedirect = dom.window.localStorage.getItem("mukra-cart");
  assert.ok(savedBeforeRedirect && savedBeforeRedirect.includes("checkout-persist-item"));

  // 2. Guest lands on /login?callbackUrl=%2Fcheckout after redirect from /checkout
  dom.reconfigure({ url: "http://localhost:3000/login?callbackUrl=%2Fcheckout" });

  // Verify LoginPage's callback resolution + clearIdentityCaches() preserves localStorage["mukra-cart"]
  const resolvedAfterLogin = safeCallbackPath(
    new URLSearchParams(dom.window.location.search).get("callbackUrl"),
    dom.window.location.origin,
  );
  assert.equal(resolvedAfterLogin, "/checkout");

  // LoginPage calls clearIdentityCaches() right before window.location.assign(callbackUrl)
  clearIdentityCaches();
  const savedAfterLogin = dom.window.localStorage.getItem("mukra-cart");
  assert.equal(savedAfterLogin, savedBeforeRedirect);

  // Simulate full browser reload at /checkout after login: fresh memory state + preserved localStorage
  dom.reconfigure({ url: "http://localhost:3000/checkout" });
  const authenticatedSession = {
    user: {
      id: "cust-1",
      name: "Verified Shopper",
      email: "shopper@example.com",
      role: "CUSTOMER" as const,
      emailVerified: true,
    },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
  context.mock.method(globalThis, "fetch", async () => Response.json(authenticatedSession));
  useCartStore.setState({ items: [], total: 0, itemCount: 0 });
  dom.window.localStorage.setItem("mukra-cart", savedAfterLogin!);
  await useCartStore.persist.rehydrate();
  assert.equal(useCartStore.getState().itemCount, 2);
  assert.equal(useCartStore.getState().total, 2500);

  const { CheckoutFlow } = await import(
    `../components/checkout/CheckoutFlow?bust=${++pageLoadSeq}`
  );

  // 3. Authenticated customer on /checkout sees Checkout step 1 with intact cart (NOT empty-bag screen)
  const populatedView = await mount(() =>
    createElement(
      SessionProvider,
      { session: authenticatedSession, refetchInterval: 0, refetchOnWindowFocus: false },
      createElement(CheckoutFlow),
    ),
  );
  try {
    assert.equal(populatedView.container.textContent?.includes("Your bag is empty"), false);
    assert.equal(populatedView.container.textContent?.includes("Contact Information"), true);
    assert.equal(populatedView.container.textContent?.includes("Golden Linen Dress"), true);
  } finally {
    await populatedView.unmount();
  }

  // 4. Empty-cart behavior remains unchanged for authenticated customer
  await act(async () => {
    useCartStore.getState().clearCart();
  });
  const emptyView = await mount(() =>
    createElement(
      SessionProvider,
      { session: authenticatedSession, refetchInterval: 0, refetchOnWindowFocus: false },
      createElement(CheckoutFlow),
    ),
  );
  try {
    assert.equal(emptyView.container.textContent?.includes("Your bag is empty"), true);
    const shopLink = emptyView.container.querySelector('a[href="/shop"]');
    assert.ok(shopLink);
    assert.equal(shopLink.textContent?.includes("Start Shopping"), true);
  } finally {
    await emptyView.unmount();
  }
});
