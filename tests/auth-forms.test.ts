import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement, StrictMode, type ComponentType } from "react";
import { toast } from "sonner";
import type * as ReactDOMClient from "react-dom/client";
import { AUTH_MESSAGES } from "../lib/auth-messages";
import { AuthFeedback } from "../components/auth/AuthFeedback";
import { useAuthFeedback } from "../hooks/useAuthFeedback";

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { url: "http://localhost/login", pretendToBeVisual: true });
type CaptchaOptions = { callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void };
const widgets = new Map<string, CaptchaOptions>();
let sequence = 0;
let createRoot: typeof ReactDOMClient.createRoot;
let LoginPage: ComponentType;
let RegisterPage: ComponentType;
before(async () => {
  Object.assign(globalThis, { window: dom.window, self: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    Element: dom.window.Element, SVGElement: dom.window.SVGElement, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(dom.window, { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }), turnstile: {
    render: (_element: HTMLElement, options: CaptchaOptions) => { const id = `auth-widget-${++sequence}`; widgets.set(id, options); return id; },
    remove: (id: string) => widgets.delete(id),
  } });
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "isolated-dom-key";
  // React's DOM event feature detection must run AFTER jsdom has installed window.
  ({ createRoot } = await import("react-dom/client"));
  LoginPage = (await import("../app/(auth)/login/page")).default;
  RegisterPage = (await import("../app/(auth)/register/page")).default;
});
after(() => { delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY; dom.window.close(); });
async function mount(component: ComponentType) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const root = createRoot(element);
  try { await act(async () => root.render(createElement(StrictMode, null, createElement(component)))); }
  catch (error) {
    if (error instanceof AggregateError) throw new Error(error.errors.map(String).join("; "));
    throw error;
  }
  return { element, async unmount() { await act(async () => root.unmount()); element.remove(); } };
}
async function change(element: HTMLElement, selector: string, value: string) {
  const input = element.querySelector<HTMLInputElement>(selector);
  assert.ok(input);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
}
async function solve() {
  const widget = [...widgets.values()].at(-1);
  assert.ok(widget);
  await act(async () => widget.callback("isolated-token"));
}

test("login form: accessible inline validation and valid-form plus captcha gating preserve legacy passwords", async () => {
  const view = await mount(LoginPage);
  try {
    const submit = view.element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    assert.equal(submit.disabled, true);
    await solve();
    assert.equal(submit.disabled, true, "Captcha alone cannot enable submit");
    await change(view.element, "#login-email", "not-an-email");
    assert.equal(view.element.querySelector("#login-email-error")?.textContent, AUTH_MESSAGES.INVALID_EMAIL);
    assert.equal(view.element.querySelector("#login-email")?.getAttribute("aria-invalid"), "true");
    assert.equal(view.element.querySelector("#login-email")?.getAttribute("aria-describedby"), "login-email-error");
    await change(view.element, "#login-email", "customer@example.com");
    await change(view.element, "#login-password", "short");
    assert.equal(submit.disabled, false, "New signup complexity must not lock out legacy accounts");
    await change(view.element, "#login-password", "");
    assert.equal(submit.disabled, true);
    assert.equal(view.element.querySelector("#login-password-error")?.textContent, AUTH_MESSAGES.PASSWORD_REQUIRED);
    assert.doesNotMatch(view.element.textContent ?? "", /demo|admin@mukra/i);
  } finally { await view.unmount(); }
});
test("login sends one non-empty Turnstile token to Credentials and remounts after rejection", async (context) => {
  const originalFetch = globalThis.fetch;
  const errors = context.mock.method(toast, "error", () => "login-captcha-error");
  const callbackBodies: URLSearchParams[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "/api/auth/providers") {
      return Response.json({ credentials: { id: "credentials", name: "Email and password", type: "credentials" } });
    }
    if (url === "/api/auth/csrf") return Response.json({ csrfToken: "isolated-csrf" });
    if (url.startsWith("/api/auth/callback/credentials?")) {
      callbackBodies.push(new URLSearchParams(String(init?.body)));
      return Response.json({
        url: "http://localhost/login?error=CredentialsSignin&code=security-verification-failed",
      });
    }
    throw new Error(`Unexpected login request: ${url}`);
  };

  const view = await mount(LoginPage);
  try {
    await change(view.element, "#login-email", "customer@example.com");
    await change(view.element, "#login-password", "legacy-password");
    await solve();
    const solvedGeneration = sequence;
    const form = view.element.querySelector("form")!;

    await act(async () => {
      // Two same-tick events model a double click before React can repaint the
      // disabled button. The solved challenge must still be consumed once.
      form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    assert.equal(callbackBodies.length, 1, "A single-use token must reach one Credentials request only");
    assert.equal(callbackBodies[0]!.get("cf-turnstile-response"), "isolated-token");
    assert.equal(callbackBodies[0]!.get("turnstileToken"), "isolated-token");
    assert.equal(callbackBodies[0]!.get("email"), "customer@example.com");
    assert.equal(callbackBodies[0]!.get("password"), "legacy-password");
    assert.ok(sequence > solvedGeneration, "A rejected login must remount Turnstile for a fresh token");
    assert.equal(view.element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled, true);
    assert.ok(view.element.textContent?.includes(AUTH_MESSAGES.SECURITY_CHECK_FAILED));
  } finally {
    globalThis.fetch = originalFetch;
    errors.mock.restore();
    await view.unmount();
  }
});

test("local development login: real widget gates submission until a token is issued", async (context) => {
  const env = process.env;
  const originalFetch = globalThis.fetch;
  const errors = context.mock.method(toast, "error", () => "login-dev-error");
  const callbackBodies: URLSearchParams[] = [];
  process.env = { ...env, NODE_ENV: "development" };
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "/api/auth/providers") {
      return Response.json({ credentials: { id: "credentials", name: "Email and password", type: "credentials" } });
    }
    if (url === "/api/auth/csrf") return Response.json({ csrfToken: "isolated-dev-csrf" });
    if (url.startsWith("/api/auth/callback/credentials?")) {
      callbackBodies.push(new URLSearchParams(String(init?.body)));
      // The captcha bypass must expose the credential verdict, not a security error.
      return Response.json({ url: "http://localhost/login?error=CredentialsSignin&code=invalid-credentials" });
    }
    throw new Error(`Unexpected login request: ${url}`);
  };

  let view: Awaited<ReturnType<typeof mount>> | undefined;
  try {
    view = await mount(LoginPage);
    assert.ok(view.element.querySelector('[data-turnstile-action="login"]'));
    assert.doesNotMatch(view.element.textContent ?? "", /Security check bypassed/);

    const submit = view.element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    assert.equal(submit.disabled, true, "An empty form stays disabled");
    await change(view.element, "#login-email", "super-admin@example.com");
    await change(view.element, "#login-password", "CorrectLookingPassword1!");
    assert.equal(submit.disabled, true, "A challenge is required in development too");
    await solve();
    assert.equal(submit.disabled, false);

    await act(async () => view!.element.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(callbackBodies.length, 1);
    assert.equal(callbackBodies[0]!.get("email"), "super-admin@example.com");
    assert.equal(callbackBodies[0]!.get("turnstileToken"), "isolated-token");
    assert.ok(view.element.textContent?.includes(AUTH_MESSAGES.INVALID_CREDENTIALS));
    assert.ok(!view.element.textContent?.includes(AUTH_MESSAGES.SECURITY_CHECK_FAILED));
  } finally {
    globalThis.fetch = originalFetch;
    process.env = env;
    errors.mock.restore();
    await view?.unmount();
  }
});

test("registration form: five strength rules, mismatch, terms and captcha gating; server duplicate maps inline", async (context) => {
  const originalFetch = globalThis.fetch;
  const errors = context.mock.method(toast, "error", () => "auth-form-error");
  const view = await mount(RegisterPage);
  try {
    const submit = view.element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    await solve();
    assert.equal(submit.disabled, true);
    await change(view.element, "#register-name", "Shopper Name");
    await change(view.element, "#register-email", "shopper@example.com");
    await change(view.element, "#register-password", "ChosenPass123");
    assert.equal(view.element.querySelector("#register-password-error")?.textContent, AUTH_MESSAGES.WEAK_PASSWORD);
    await change(view.element, "#register-password", "ChosenPass123!");
    await change(view.element, "#register-confirm", "WrongPass123!");
    assert.ok(view.element.textContent?.includes(AUTH_MESSAGES.PASSWORD_MISMATCH));
    await change(view.element, "#register-confirm", "ChosenPass123!");
    assert.equal(submit.disabled, true, "Terms still required");
    const terms = view.element.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => terms.click());
    assert.equal(submit.disabled, false);
    globalThis.fetch = async () => Response.json({ code: "EMAIL_ALREADY_EXISTS", error: "PRIVATE database error", fieldErrors: { email: "EMAIL_ALREADY_EXISTS", maliciousField: "INVALID_EMAIL" } }, { status: 409 });
    await act(async () => view.element.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(view.element.querySelector("#register-email-error")?.textContent, AUTH_MESSAGES.EMAIL_ALREADY_EXISTS);
    assert.ok(view.element.textContent?.includes(AUTH_MESSAGES.EMAIL_ALREADY_EXISTS));
    assert.doesNotMatch(view.element.textContent ?? "", /PRIVATE|maliciousField|demo/i);
    assert.equal(errors.mock.calls.at(-1)?.arguments[1]?.duration, Infinity);
    assert.equal(submit.disabled, true, "A used captcha cannot be resubmitted");
    await change(view.element, "#register-email", "other@example.com");
    assert.ok(!view.element.textContent?.includes(AUTH_MESSAGES.EMAIL_ALREADY_EXISTS), "Editing clears stale server feedback");
  } finally { globalThis.fetch = originalFetch; errors.mock.restore(); await view.unmount(); }
});

test("registration captcha: visible directly above submit; unsolved attempts guide inline without a request; expiry disables again", async () => {
  const originalFetch = globalThis.fetch;
  const view = await mount(RegisterPage);
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("Must not submit without captcha"); };
  try {
    const submit = view.element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const area = view.element.querySelector<HTMLElement>('section[aria-label="Captcha verification"]')!;
    const guidance = () => view.element.querySelector("#register-captcha-guidance")!;
    assert.ok(area.querySelector('[data-turnstile-action="register"] [id^="mukra-turnstile-"]'));
    assert.match(area.textContent ?? "", /Please complete the security check to continue\./);
    assert.equal(submit.previousElementSibling, area);
    assert.equal(submit.getAttribute("aria-describedby"), "register-captcha-guidance");
    assert.equal(guidance().textContent, "", "The widget card carries the standing instruction");
    assert.equal(submit.disabled, true);
    await act(async () => view.element.querySelector("#register-email")!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    assert.equal(guidance().getAttribute("role"), "alert", "Enter explains the requirement even when the disabled button suppresses native submit");
    // Invalid-field submissions also provide captcha guidance.
    await act(async () => view.element.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(guidance().getAttribute("role"), "alert");
    assert.equal(guidance().textContent, "Please complete the captcha verification.");
    await change(view.element, "#register-name", "Captcha Shopper");
    await change(view.element, "#register-email", "captcha@example.com");
    await change(view.element, "#register-password", "ChosenPass123!");
    await change(view.element, "#register-confirm", "ChosenPass123!");
    await act(async () => view.element.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    assert.equal(submit.disabled, true, "A valid form without captcha remains blocked");
    await act(async () => view.element.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(requests, 0);
    assert.equal(guidance().textContent, "Please complete the captcha verification.");
    await solve();
    assert.equal(submit.disabled, false);
    assert.equal(guidance().getAttribute("role"), "status");
    assert.equal(guidance().textContent, "", "The widget's success state makes duplicate green confirmation copy unnecessary");
    await act(async () => [...widgets.values()].at(-1)!["expired-callback"]());
    assert.equal(submit.disabled, true);
    assert.match(view.element.textContent ?? "", /Security check expired/);
    assert.equal(guidance().textContent, "", "The widget card announces the expiry inline");
    assert.equal(requests, 0);
  } finally { globalThis.fetch = originalFetch; await view.unmount(); }
});
test("registration missing site key: neutral fallback, no internal configuration details, disabled submit", async (context) => {
  const env = process.env;
  const log = context.mock.method(console, "log", () => {});
  // The development bypass is intentionally not active here: this test covers
  // the non-development missing-key fallback.
  process.env = { ...env, NODE_ENV: "test" };
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  let view: Awaited<ReturnType<typeof mount>> | undefined;
  try {
    view = await mount(RegisterPage);
    const submit = view.element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const area = submit.previousElementSibling!;
    assert.ok(area.querySelector('[data-turnstile-action="register"]'));
    assert.match(area.textContent ?? "", /Verification unavailable/);
    assert.doesNotMatch(area.textContent ?? "", /Security check unavailable/);
    assert.doesNotMatch(view.element.textContent ?? "", /TURNSTILE DEBUG|Site Key|NEXT_PUBLIC_TURNSTILE_SITE_KEY|Development setup|\.env\.local/);
    assert.equal(submit.disabled, true);
    assert.equal(widgets.size, 0);
    assert.equal(log.mock.callCount(), 0);
  } finally { await view?.unmount(); log.mock.restore(); process.env = env; }
});

function FeedbackHarness() {
  const feedback = useAuthFeedback();
  return createElement("div", null,
    createElement(AuthFeedback, { message: feedback.message, warning: feedback.warning, onDismiss: feedback.clear }),
    createElement("button", { id: "show-error", onClick: () => feedback.show("INVALID_CREDENTIALS") }, "Error"),
    createElement("button", { id: "show-warning", onClick: () => feedback.show("EMAIL_NOT_VERIFIED") }, "Warning"));
}
test("feedback: errors persist, warnings are yellow, dismiss/replacement/unmount clean up toasts in Strict Mode", async (context) => {
  const error = context.mock.method(toast, "error", () => "persistent-error");
  const warning = context.mock.method(toast, "warning", () => "persistent-warning");
  const dismiss = context.mock.method(toast, "dismiss", () => "dismissed");
  const view = await mount(FeedbackHarness);
  try {
    await act(async () => view.element.querySelector<HTMLButtonElement>("#show-error")!.click());
    assert.equal(view.element.querySelector('[role="alert"]')?.textContent, AUTH_MESSAGES.INVALID_CREDENTIALS);
    assert.ok(view.element.querySelector('[role="alert"]')?.className.includes("rose"));
    assert.equal(error.mock.calls[0]?.arguments[1]?.duration, Infinity);
    await act(async () => view.element.querySelector<HTMLButtonElement>("#show-warning")!.click());
    assert.ok(view.element.querySelector('[role="alert"]')?.className.includes("amber"));
    assert.equal(warning.mock.calls[0]?.arguments[1]?.duration, Infinity);
    assert.ok(dismiss.mock.calls.some((call) => call.arguments[0] === "persistent-error"));
    await act(async () => view.element.querySelector<HTMLButtonElement>('[aria-label="Dismiss message"]')!.click());
    assert.equal(view.element.querySelector('[role="alert"]'), null);
    await act(async () => view.element.querySelector<HTMLButtonElement>("#show-error")!.click());
  } finally { await view.unmount(); }
  assert.ok(dismiss.mock.calls.filter((call) => call.arguments[0] === "persistent-error").length >= 2);
});
