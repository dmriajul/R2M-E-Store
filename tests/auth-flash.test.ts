import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { toast } from "sonner";
import { queueAuthSuccess, consumeAuthSuccess, AUTH_SUCCESS_DURATION } from "../lib/auth-flash";
import { AUTH_SUCCESS_MESSAGES } from "../lib/auth-messages";

const dom = new JSDOM("", { url: "http://localhost/" });
Object.assign(globalThis, { window: dom.window });
afterEach(() => dom.window.sessionStorage.clear());
after(() => dom.window.close());

test("sign-in success survives navigation as one non-sensitive code, consumed only once", () => {
  queueAuthSuccess("SIGNED_IN");
  assert.equal(dom.window.sessionStorage.getItem("mukra-auth-success"), "SIGNED_IN");
  assert.equal(consumeAuthSuccess(), AUTH_SUCCESS_MESSAGES.SIGNED_IN);
  assert.equal(consumeAuthSuccess(), null);
  assert.equal(dom.window.sessionStorage.length, 0);
  assert.equal(AUTH_SUCCESS_DURATION, 5000);
});
test("registration success flash uses centralized professional copy", () => {
  queueAuthSuccess("ACCOUNT_CREATED");
  assert.equal(consumeAuthSuccess(), AUTH_SUCCESS_MESSAGES.ACCOUNT_CREATED);
  assert.doesNotMatch(AUTH_SUCCESS_MESSAGES.ACCOUNT_CREATED, /demo|admin@mukra/i);
});
test("modified flash storage cannot inject raw/prototype messages into the global toaster", () => {
  for (const value of ["<script>private</script>", "toString", "__proto__", ""]) {
    dom.window.sessionStorage.setItem("mukra-auth-success", value);
    assert.equal(consumeAuthSuccess(), null);
    assert.equal(dom.window.sessionStorage.length, 0);
  }
});
test("blocked sessionStorage does not prevent navigation; success fallback still lasts 5 seconds", (context) => {
  const success = context.mock.method(toast, "success", () => "success-fallback");
  const descriptor = Object.getOwnPropertyDescriptor(dom.window, "sessionStorage")!;
  try {
    Object.defineProperty(dom.window, "sessionStorage", { configurable: true, get() { throw new Error("Storage blocked"); } });
    assert.doesNotThrow(() => queueAuthSuccess("SIGNED_IN"));
    assert.equal(consumeAuthSuccess(), null);
    assert.equal(success.mock.calls[0]?.arguments[0], AUTH_SUCCESS_MESSAGES.SIGNED_IN);
    assert.equal(success.mock.calls[0]?.arguments[1]?.duration, 5000);
  } finally { Object.defineProperty(dom.window, "sessionStorage", descriptor); }
});
