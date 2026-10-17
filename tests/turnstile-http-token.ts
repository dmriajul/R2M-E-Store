import assert from "node:assert/strict";

/** Only meaningful against the external isolated test-provider preload, never live Cloudflare. */
export function fixtureToken(action: "login" | "register" | "resend_verification", scenario = "valid"): string {
  assert.equal(process.env.TURNSTILE_TEST_PROVIDER, "isolated", "Start an isolated server with the documented test provider; this is not a live Cloudflare token");
  return `fixture:${action}:${scenario}:${crypto.randomUUID()}`;
}
