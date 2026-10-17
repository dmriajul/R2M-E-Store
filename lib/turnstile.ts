import type { TurnstileAction } from "@/lib/turnstile-shared";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const TURNSTILE_ALWAYS_PASS_TEST_SECRET = "1x0000000000000000000000000000000AA";
const TURNSTILE_TEST_SITE_KEYS = new Set([
  "1x00000000000000000000AA",
  "1x00000000000000000000BB",
  "2x00000000000000000000AB",
  "2x00000000000000000000BB",
  "3x00000000000000000000FF",
]);
const TURNSTILE_TEST_SECRETS = new Set([
  TURNSTILE_ALWAYS_PASS_TEST_SECRET,
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);
const LOOPBACK_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "0:0:0:0:0:0:0:1",
  "::ffff:127.0.0.1",
]);
const LOCALHOST = "localhost";

type TurnstileFailureReason =
  | "invalid-token"
  | "missing-secret"
  | "missing-hostname-configuration"
  | "test-secret-in-production"
  | "provider-http-error"
  | "invalid-provider-response"
  | "provider-rejected-token"
  | "action-mismatch"
  | "hostname-mismatch"
  | "provider-unavailable";

/**
 * Canonicalise hostnames before comparing them.
 *
 * Cloudflare reports no port, while local configuration is frequently written
 * as either `localhost`, `127.0.0.1:3000`, or a complete local origin. Treat
 * loopback spellings as the same machine, but keep every non-local hostname an
 * exact match (no suffixes or wildcards).
 */
function canonicalHostname(hostname: string): string | null {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  if (!normalized) return null;
  return LOOPBACK_HOSTNAMES.has(normalized) ? LOCALHOST : normalized;
}

function configuredHostname(value: string): string | null {
  const entry = value.trim();
  if (!entry) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(entry) ? entry : `http://${entry}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return canonicalHostname(url.hostname);
  } catch {
    return null;
  }
}

function providerHostname(value: unknown): string | null {
  if (typeof value !== "string" || /[\s/@]/.test(value)) return null;
  // Siteverify returns a hostname, never an origin or host:port. Colons are
  // accepted only for the loopback IPv6 forms canonicalHostname knows about.
  const normalized = canonicalHostname(value);
  if (!normalized) return null;
  if (normalized.includes(":") && normalized !== LOCALHOST) return null;
  return normalized;
}

function allowedHostnames(): Set<string> {
  const hosts = new Set<string>();
  const explicit = process.env.TURNSTILE_ALLOWED_HOSTNAMES?.trim();
  if (explicit) {
    for (const entry of explicit.split(",")) {
      const hostname = configuredHostname(entry);
      if (hostname) hosts.add(hostname);
    }
  } else {
    for (const origin of [process.env.AUTH_URL, process.env.NEXTAUTH_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
      if (!origin) continue;
      const hostname = configuredHostname(origin);
      if (hostname) hosts.add(hostname);
    }
  }

  // An explicit production allowlist still takes precedence. In local
  // development, however, spelling the same loopback host differently must not
  // invalidate an otherwise legitimate challenge.
  if (process.env.NODE_ENV !== "production") hosts.add(LOCALHOST);
  return hosts;
}

function isOfficialLocalTestResponse(secret: string, token: string): boolean {
  return process.env.NODE_ENV !== "production" &&
    secret === TURNSTILE_ALWAYS_PASS_TEST_SECRET &&
    TURNSTILE_TEST_SITE_KEYS.has(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "") &&
    token === TURNSTILE_DUMMY_TOKEN;
}

function rejected(reason: TurnstileFailureReason): false {
  // A safe local diagnostic identifies the failed gate without exposing the
  // token, secret, submitted credentials, provider payload, action or hostname.
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[turnstile] Verification rejected: ${reason}.`);
  }
  return false;
}

/** Server-only call sites. Missing configuration, outages, bad data and replays fail closed. */
export async function verifyTurnstileToken(
  token: unknown,
  options: { action: TurnstileAction },
): Promise<boolean> {
  if (typeof token !== "string") return rejected("invalid-token");
  const normalizedToken = token.trim();
  if (!normalizedToken || normalizedToken.length > 2048) return rejected("invalid-token");

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return rejected("missing-secret");
  if (process.env.NODE_ENV === "production" && TURNSTILE_TEST_SECRETS.has(secret)) {
    return rejected("test-secret-in-production");
  }

  const hosts = allowedHostnames();
  if (!hosts.size) return rejected("missing-hostname-configuration");

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: normalizedToken }).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return rejected("provider-http-error");

    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return rejected("invalid-provider-response");
    }
    const verdict = result as Record<string, unknown>;
    if (verdict.success !== true) return rejected("provider-rejected-token");

    const officialLocalTest = isOfficialLocalTestResponse(secret, normalizedToken);
    // Cloudflare's official dummy token has static metadata (`action: "test"`),
    // so it cannot echo the widget action. Permit that documented value only
    // for the exact official test key pair outside production. Real tokens
    // remain strictly bound to their per-form action.
    const actionMatches = verdict.action === options.action ||
      (officialLocalTest && verdict.action === "test");
    if (!actionMatches) return rejected("action-mismatch");

    const hostname = providerHostname(verdict.hostname);
    if (!hostname || !hosts.has(hostname)) return rejected("hostname-mismatch");
    return true;
  } catch {
    // Never log tokens, keys, provider response bodies, or request details.
    return rejected("provider-unavailable");
  }
}

/** Server-only configuration readiness; deliberately does not reveal any key/hostname. */
export function isTurnstileServerConfigured(): boolean {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  return Boolean(secret) &&
    !(process.env.NODE_ENV === "production" && TURNSTILE_TEST_SECRETS.has(secret ?? "")) &&
    allowedHostnames().size > 0;
}

let configurationWarningLogged = false;

/**
 * Server-only operational warning, emitted at most once per process.
 *
 * Nothing is rendered to the browser: when the public key is absent the widget
 * shows its neutral "unavailable" fallback and every auth submit stays
 * disabled. Only variable names are logged — never key values, tokens or hosts.
 */
export function warnOnTurnstileConfigurationGaps(): void {
  if (configurationWarningLogged) return;
  const publicKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (publicKey && secret && isTurnstileServerConfigured()) return;
  configurationWarningLogged = true;
  const missing = [
    !publicKey ? "NEXT_PUBLIC_TURNSTILE_SITE_KEY" : null,
    !secret ? "TURNSTILE_SECRET_KEY" : null,
    allowedHostnames().size === 0 ? "TURNSTILE_ALLOWED_HOSTNAMES" : null,
    process.env.NODE_ENV === "production" && secret && TURNSTILE_TEST_SECRETS.has(secret)
      ? "production Turnstile secret"
      : null,
  ].filter((name): name is string => Boolean(name));
  console.warn(
    `[turnstile] Security verification is not fully configured (missing or invalid: ${missing.join(", ")}). ` +
      "Authentication submissions stay disabled until the Turnstile widget is available.",
  );
}
