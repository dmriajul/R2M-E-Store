import { isTurnstileBypassed, type TurnstileAction } from "@/lib/turnstile-shared";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
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

function isOfficialLocalTestConfiguration(secret: string): boolean {
  return process.env.NODE_ENV !== "production" &&
    secret === TURNSTILE_ALWAYS_PASS_TEST_SECRET &&
    TURNSTILE_TEST_SITE_KEYS.has(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "");
}

type SafeProviderDiagnostic = {
  errorCodes?: string[];
  action?: string;
  hostname?: string;
};

function rejected(reason: TurnstileFailureReason, diagnostic?: SafeProviderDiagnostic): false {
  // Local-only diagnostics expose only Siteverify's relevant binding/error
  // fields; never log the token, secret, credentials, IP or entire response.
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[turnstile] Verification rejected: ${reason}.`, diagnostic ?? "");
  }
  return false;
}

let developmentBypassWarningLogged = false;
function warnOnDevelopmentBypass(): void {
  if (developmentBypassWarningLogged) return;
  developmentBypassWarningLogged = true;
  console.warn(
    "[turnstile] LOCAL DEVELOPMENT: CAPTCHA verification is bypassed (NODE_ENV=development). " +
      "Production builds always enforce Cloudflare Turnstile.",
  );
}

/**
 * Server-only call sites. Missing configuration, outages, bad data and replays
 * fail closed.
 *
 * Local development is the one exception: `next dev` cannot be blocked on a
 * CAPTCHA whose widget/keys/CDN may not be reachable. That bypass is neither
 * buildable nor runtime-enableable in production (NODE_ENV is inlined by
 * Next.js), and the caller still verifies credentials against the database.
 */
export async function verifyTurnstileToken(
  token: unknown,
  options: { action: TurnstileAction },
): Promise<boolean> {
  if (isTurnstileBypassed()) {
    warnOnDevelopmentBypass();
    return true;
  }

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
    const diagnostic: SafeProviderDiagnostic = {
      errorCodes: Array.isArray(verdict["error-codes"])
        ? verdict["error-codes"].filter((code): code is string =>
          typeof code === "string" && /^[a-z-]{1,64}$/.test(code),
        ).slice(0, 8)
        : undefined,
      action: typeof verdict.action === "string" ? verdict.action.slice(0, 64) : undefined,
      hostname: typeof verdict.hostname === "string" ? verdict.hostname.slice(0, 253) : undefined,
    };
    if (verdict.success !== true) return rejected("provider-rejected-token", diagnostic);

    const officialLocalTest = isOfficialLocalTestConfiguration(secret);
    // The official test widget may return provider-static `test` metadata (or
    // omit action) instead of echoing `login`. Permit only that metadata with
    // the exact public test site/secret pair outside production. Do not require
    // the widget token to equal Cloudflare's separate documented dummy sample:
    // the browser widget can issue its own successful test token.
    const actionMatches = verdict.action === options.action ||
      (officialLocalTest && (verdict.action === "test" || verdict.action === undefined || verdict.action === null));
    if (!actionMatches) return rejected("action-mismatch", diagnostic);

    const hostname = providerHostname(verdict.hostname);
    if (!hostname || !hosts.has(hostname)) return rejected("hostname-mismatch", diagnostic);
    return true;
  } catch {
    // Never log tokens, keys, provider response bodies, or request details.
    return rejected("provider-unavailable");
  }
}

/** Server-only configuration readiness; deliberately does not reveal any key/hostname. */
export function isTurnstileServerConfigured(): boolean {
  // Local development does not need provider configuration to sign in.
  if (isTurnstileBypassed()) return true;
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
  // Development submissions are not disabled, so the configuration warning
  // would be misleading. The bypass warning above is the relevant diagnostic.
  if (configurationWarningLogged || isTurnstileBypassed()) return;
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
