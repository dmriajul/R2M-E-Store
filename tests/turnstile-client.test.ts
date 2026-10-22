import assert from "node:assert/strict";
import { after, test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { TurnstileCaptcha } from "../components/TurnstileCaptcha";
import { useTurnstile } from "../hooks/useTurnstile";

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { url: "http://localhost/" });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, MutationObserver: dom.window.MutationObserver,
  IS_REACT_ACT_ENVIRONMENT: true,
});
after(() => dom.window.close());

type WidgetOptions = { callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void; action: string; appearance: string; theme: string; size: string };
const widgets = new Map<string, WidgetOptions>();
const removed = new Set<string>();
let sequence = 0;
Object.assign(dom.window, { turnstile: {
  render: (_element: HTMLElement, options: WidgetOptions) => {
    const id = `widget-${++sequence}`;
    widgets.set(id, options);
    return id;
  },
  reset: () => {},
  remove: (id: string) => { removed.add(id); widgets.delete(id); },
} });

function Form() {
  const captcha = useTurnstile();
  return createElement("form", { onSubmit: (event) => { event.preventDefault(); captcha.reset(); } },
    createElement(TurnstileCaptcha, { key: captcha.generation, action: "login", onVerify: captcha.onVerify, onError: captcha.onError }),
    createElement("button", { type: "submit", disabled: !captcha.token }, "Submit"));
}
function mount() {
  const element = document.createElement("div");
  document.body.appendChild(element);
  return { element, root: createRoot(element) };
}
async function flush() { await act(async () => { await Promise.resolve(); }); }
function latestWidget() {
  const widget = [...widgets.values()].at(-1);
  assert.ok(widget, "Widget should be mounted");
  return widget;
}

test("never renders debug banners, key values or internal configuration hints", async (context) => {
  const originalEnv = process.env;
  const log = context.mock.method(console, "log", () => {});
  try {
    process.env = { ...originalEnv, NODE_ENV: "development", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "debug-public-key-do-not-display" };
    const render = () => renderToString(createElement(TurnstileCaptcha, { action: "register", onVerify: () => {} }));
    const present = render();
    assert.ok(!present.includes("TURNSTILE DEBUG"));
    assert.ok(!present.includes("Site Key"));
    assert.ok(!present.includes("debug-public-key-do-not-display"));
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const missing = render();
    assert.ok(!missing.includes("TURNSTILE DEBUG"));
    assert.ok(!missing.includes("Site Key"));
    assert.ok(!missing.includes("NEXT_PUBLIC_TURNSTILE_SITE_KEY"));
    assert.ok(!missing.includes("Development setup"));
    assert.match(missing, /Verification unavailable/);
    process.env = { ...process.env, NODE_ENV: "production", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "debug-public-key-do-not-display" };
    const production = render();
    assert.ok(!production.includes("TURNSTILE DEBUG"));
    assert.ok(!production.includes("debug-public-key-do-not-display"));
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    assert.ok(!render().includes("TURNSTILE DEBUG"));
    // The client component stays silent; missing configuration is reported
    // server-side only (see lib/turnstile.ts).
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "debug-public-key-do-not-display";
    const { root, element } = mount();
    await act(async () => root.render(createElement(TurnstileCaptcha, { action: "register", onVerify: () => {} })));
    assert.equal(typeof (window as unknown as Record<string, unknown>).onloadTurnstileCallback, "function",
      "The script loader must not delete the callback Cloudflare invokes");
    await act(async () => root.unmount());
    element.remove();
    assert.equal(log.mock.callCount(), 0);
  } finally {
    log.mock.restore();
    process.env = originalEnv;
  }
});

test("missing site key is a visible error, never a silently hidden widget", async () => {
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const { root, element } = mount();
  await act(async () => { root.render(createElement(Form)); });
  assert.ok(element.textContent?.includes("Verification unavailable"));
  assert.doesNotMatch(element.textContent ?? "", /Security check unavailable/);
  assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, true);
  await act(async () => root.unmount());
  element.remove();
});

test("SSR hydrates without warnings; Strict Mode deduplicates script, expiry/reset/error disable submit and unmount removes widgets", async () => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "isolated-browser-test-key";
  const element = document.createElement("div");
  element.innerHTML = renderToString(createElement(StrictMode, null, createElement(Form)));
  document.body.appendChild(element);
  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => { root = hydrateRoot(element, createElement(StrictMode, null, createElement(Form))); });
    await flush();
    assert.equal(document.querySelectorAll("#cf-turnstile-script").length, 1);
    assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, true);
    const widget = latestWidget();
    assert.equal(widget.appearance, "always");
    assert.equal(widget.action, "login");
    assert.equal(widget.theme, "dark");
    assert.equal(widget.size, "flexible");
    assert.ok(element.textContent?.includes("Please complete the security check to continue."),
      "A visible instruction guides the user while the widget awaits verification");
    await act(async () => widget.callback("token-one"));
    assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, false);
    await act(async () => widget["expired-callback"]());
    assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, true);
    assert.ok(element.textContent?.includes("expired"));
    await act(async () => widget.callback("token-two"));
    const before = removed.size;
    await act(async () => element.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
    await flush();
    assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, true);
    assert.ok(removed.size > before, "A submission must discard the single-use widget");
    const current = latestWidget();
    await act(async () => current.callback("token-three"));
    await act(async () => current["error-callback"]());
    assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, true);
    assert.ok(element.textContent?.includes("Security check failed to load"));
    await act(async () => current.callback("recovered-token"));
    assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, false);
    await act(async () => root.unmount());
    assert.equal(widgets.size, 0);
    await act(async () => current.callback("late-token"));
    assert.equal(document.querySelectorAll("#cf-turnstile-script").length, 1);
    assert.deepEqual(errors, [], "No hydration, Strict Mode or widget warnings expected");
  } finally { console.error = originalError; element.remove(); }
});

test("blocked script presents fallback and keeps submit disabled", async () => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "isolated-browser-test-key";
  const { root, element } = mount();
  await act(async () => root.render(createElement(Form)));
  const script = document.querySelector("#cf-turnstile-script");
  assert.ok(script);
  await act(async () => script.dispatchEvent(new dom.window.Event("error")));
  assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, true);
  assert.ok(element.textContent?.includes("Security check failed to load"));
  await act(async () => root.unmount());
  element.remove();
});

test("local token lifetime clears and remounts before Cloudflare's five-minute expiry", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { root, element } = mount();
  await act(async () => root.render(createElement(Form)));
  await flush();
  await act(async () => latestWidget().callback("short-lived-token"));
  assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, false);
  await act(async () => context.mock.timers.tick(250_000));
  assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, true);
  await act(async () => root.unmount());
  element.remove();
});

test("slow widget remains mounted and accepts success after five seconds", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { root, element } = mount();
  await act(async () => root.render(createElement(Form)));
  await flush();
  const widget = latestWidget();
  await act(async () => context.mock.timers.tick(15_000));
  assert.ok(!element.textContent?.includes("Verification unavailable"));
  assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, true);
  assert.ok(element.querySelector('[id^="mukra-turnstile-"]'));
  await act(async () => widget.callback("late-token"));
  assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, false);
  await act(async () => root.unmount());
  element.remove();
});

for (const action of ["login", "register"] as const) {
  test(`${action} with a public key renders the actual widget container even before hydration`, async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "render-test-key";
    const props = { action, onVerify: () => {} };
    const ssr = document.createElement("div");
    ssr.innerHTML = renderToString(createElement(TurnstileCaptcha, props));
    assert.ok(ssr.querySelector(`[data-turnstile-action="${action}"] [id^="mukra-turnstile-"]`));
    assert.ok(ssr.textContent?.includes("Loading security check..."),
      "SSR renders an elegant loading state, never broken-fallback copy");
    const { root, element } = mount();
    await act(async () => root.render(createElement(TurnstileCaptcha, props)));
    assert.ok(element.querySelector(`[data-turnstile-action="${action}"] [id^="mukra-turnstile-"]`));
    assert.equal(latestWidget().action, action);
    const script = document.querySelector<HTMLScriptElement>("#cf-turnstile-script");
    assert.ok(script?.src.startsWith("https://challenges.cloudflare.com/turnstile/v0/api.js?"));
    await act(async () => root.unmount());
    element.remove();
  });
}


test("unresponsive CDN times out at 15 seconds and manual retry reloads the script", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const api = window.turnstile;
  delete (window as unknown as Record<string, unknown>).turnstile;
  document.getElementById("cf-turnstile-script")?.remove();
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "isolated-browser-test-key";
  const { root, element } = mount();
  try {
    await act(async () => root.render(createElement(Form)));
    const script = document.getElementById("cf-turnstile-script");
    await act(async () => context.mock.timers.tick(14_999));
    assert.match(element.textContent ?? "", /Loading security check/);
    await act(async () => context.mock.timers.tick(1));
    assert.match(element.textContent ?? "", /Security check failed to load/);
    assert.match(element.textContent ?? "", /disable ad-blockers/);
    assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, true);
    await act(async () => element.querySelector<HTMLButtonElement>('button[type="button"]')!.click());
    assert.notEqual(document.getElementById("cf-turnstile-script"), script);
    assert.match(element.textContent ?? "", /Loading security check/);
    Object.assign(window, { turnstile: api });
  } finally {
    Object.assign(window, { turnstile: api });
    await act(async () => root.unmount());
    element.remove();
  }
});
