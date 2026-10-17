// EXTERNAL TEST HARNESS ONLY. Never imported by app code or deployed with NODE_OPTIONS.
// The application still performs its normal siteverify POST; this isolated process mocks the provider.
const secret = "isolated-test-secret-not-a-live-key";
const origin = new URL(process.env.AUTH_URL || "http://invalid.example");
if (process.env.TURNSTILE_TEST_PROVIDER !== "isolated" ||
    process.env.TEST_ISOLATED_AUTH !== "true" ||
    (process.env.DATABASE_URL && process.env.DATABASE_URL !== "postgresql://isolated.invalid/mukra-test") ||
    process.env.MAILJET_API_KEY || process.env.MAILJET_SECRET_KEY ||
    process.env.TURNSTILE_SECRET_KEY !== secret ||
    !["localhost", "127.0.0.1"].includes(origin.hostname)) {
  throw new Error("Turnstile test provider refuses non-isolated/non-demo configuration");
}
const originalFetch = globalThis.fetch;
const used = new Set();
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url !== "https://challenges.cloudflare.com/turnstile/v0/siteverify") return originalFetch(input, init);
  const params = new URLSearchParams(String(init?.body));
  const token = params.get("response") || "";
  const [prefix, action, scenario, nonce] = token.split(":");
  if (params.get("secret") !== secret || prefix !== "fixture" || !nonce || used.has(token)) {
    return Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] });
  }
  used.add(token);
  if (scenario === "network") throw new TypeError("Simulated provider network outage");
  if (scenario === "http") return new Response("unavailable", { status: 503 });
  if (scenario === "json") return new Response("malformed");
  if (scenario === "invalid" || scenario === "expired") return Response.json({ success: false });
  return Response.json({
    success: scenario === "truthy" ? "true" : true,
    action: scenario === "wrong-action" ? "unrelated" : action,
    hostname: scenario === "wrong-host" ? "untrusted.example" : "localhost",
  });
};
