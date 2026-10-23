import {
  getTurnstileSiteKey,
  isTurnstileBypassed,
  isTurnstileKeyBoundaryValid,
  sanitizeTurnstileEnvValue,
  TURNSTILE_RESPONSE_FIELD,
  type TurnstileAction,
} from "@/lib/turnstile-shared";

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
/** Real Cloudflare Turnstile site keys are 24 chars (`0x` + 22 base64url chars). */
const CLOUDFLARE_SITE_KEY_SHAPE = /^0x[A-Za-z0-9_-]{22}$/;
const INVISIBLE_TOKEN_CHARS = /[\u0000-\u001F\u007F\u200B-\u200D\u2060\uFEFF]/g;
const LOOPBACK_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "0:0:0:0:0:0:0:1",
  "::ffff:127.0.0.1",
]);
const SHARED_PLATFORM_SUFFIXES = [
  ".vercel.app",
  ".pages.dev",
  ".workers.dev",
  ".netlify.app",
  ".onrender.com",
  ".railway.app",
  ".fly.dev",
  ".e2b.app",
  ".e2b.dev",
] as const;
const LOCALHOST = "localhost";
const TURNSTILE_TOKEN_FIELDS = [
  TURNSTILE_RESPONSE_FIELD,
  "turnstileToken",
  "cfTurnstileResponse",
  "captchaToken",
  "token",
] as const;

export type TurnstileFailureReason =
  | "invalid-token"
  | "missing-secret"
  | "invalid-secret-format"
  | "missing-hostname-configuration"
  | "test-secret-in-production"
  | "provider-http-error"
  | "invalid-provider-response"
  | "provider-rejected-token"
  | "action-mismatch"
  | "hostname-mismatch"
  | "provider-unavailable";

export interface VerifyTurnstileOptions {
  action: TurnstileAction;
  remoteIp?: string | null;
  requestHeaders?: Headers | null;
}

export interface TurnstileSecretResolution {
  secret: string;
  error: "missing-secret" | "invalid-secret-format" | null;
  looksLikeSiteKey: boolean;
}

/**
 * Cleanly read `TURNSTILE_SECRET_KEY` without extraneous quotes, whitespace,
 * BOM/zero-width/control characters, `TURNSTILE_SECRET_KEY=` prefixes, or
 * inline `#` comments, while rejecting invalid interior character boundaries.
 */
export function readTurnstileSecretKey(
  rawValue: string | undefined = process.env.TURNSTILE_SECRET_KEY,
): TurnstileSecretResolution {
  const cleaned = sanitizeTurnstileEnvValue(rawValue, "TURNSTILE_SECRET_KEY");
  if (!cleaned) {
    return { secret: "", error: "missing-secret", looksLikeSiteKey: false };
  }
  if (!isTurnstileKeyBoundaryValid(cleaned)) {
    return { secret: "", error: "invalid-secret-format", looksLikeSiteKey: false };
  }
  return {
    secret: cleaned,
    error: null,
    looksLikeSiteKey: CLOUDFLARE_SITE_KEY_SHAPE.test(cleaned),
  };
}

function cleanTokenCandidate(value: string): string {
  const trimmed = value.replace(INVISIBLE_TOKEN_CHARS, "").trim();
  if (trimmed === "undefined" || trimmed === "null") return "";
  return trimmed;
}

/**
 * Extract the Turnstile response token from a parsed request payload or form.
 *
 * Canonical `cf-turnstile-response` takes precedence, with `turnstileToken`
 * retained so existing API/NextAuth callers remain compatible. Stringified
 * `"undefined"` / `"null"` placeholders from `URLSearchParams` are ignored so
 * they never shadow a real token in a sibling field.
 */
export function extractTurnstileToken(
  payload: unknown,
  headers?: Headers | null,
): unknown {
  if (typeof payload === "string") return cleanTokenCandidate(payload);

  if (payload instanceof FormData || payload instanceof URLSearchParams) {
    let firstDefined: unknown = undefined;
    for (const field of TURNSTILE_TOKEN_FIELDS) {
      const value = payload.get(field);
      if (value === null) continue;
      if (typeof value === "string") {
        const cleaned = cleanTokenCandidate(value);
        if (cleaned.length > 0) return cleaned;
        if (firstDefined === undefined) firstDefined = "";
      } else if (firstDefined === undefined) {
        firstDefined = value;
      }
    }
    if (firstDefined !== undefined && firstDefined !== "") return firstDefined;
    const headerFallback = cleanHeaderToken(headers);
    if (headerFallback) return headerFallback;
    if (firstDefined !== undefined) return firstDefined;
  } else if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    let firstDefined: unknown = undefined;
    for (const field of TURNSTILE_TOKEN_FIELDS) {
      if (!Object.hasOwn(record, field)) continue;
      const value = record[field];
      if (value === undefined) continue;
      if (typeof value === "string") {
        const cleaned = cleanTokenCandidate(value);
        if (cleaned.length > 0) return cleaned;
        if (firstDefined === undefined) firstDefined = "";
      } else if (firstDefined === undefined) {
        firstDefined = value;
      }
    }
    if (firstDefined !== undefined && firstDefined !== "") return firstDefined;
    const headerFallback = cleanHeaderToken(headers);
    if (headerFallback) return headerFallback;
    if (firstDefined !== undefined) return firstDefined;
  }

  const headerToken = cleanHeaderToken(headers);
  if (headerToken) return headerToken;
  return undefined;
}

function cleanHeaderToken(headers?: Headers | null): string {
  if (!headers) return "";
  const cfHeader = headers.get(TURNSTILE_RESPONSE_FIELD);
  if (cfHeader) {
    const cleaned = cleanTokenCandidate(cfHeader);
    if (cleaned) return cleaned;
  }
  const altHeader = headers.get("x-turnstile-token");
  if (altHeader) {
    const cleaned = cleanTokenCandidate(altHeader);
    if (cleaned) return cleaned;
  }
  return "";
}

/**
 * Parse a JSON, URL-encoded, or multipart auth request body into a safe plain
 * object so route handlers can read `cf-turnstile-response` regardless of how
 * the form or fetch client encoded the login/registration submission.
 */
export async function parseTurnstileRequestRecord(
  request: Request,
): Promise<{ record: Record<string, unknown>; formEncoded: boolean } | null> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    try {
      const params = new URLSearchParams(await request.text());
      const record: Record<string, unknown> = {};
      for (const [key, value] of params.entries()) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
        record[key] = value;
      }
      return { record, formEncoded: true };
    } catch {
      return null;
    }
  }

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const record: Record<string, unknown> = {};
      for (const [key, value] of formData.entries()) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
        if (typeof value === "string") record[key] = value;
      }
      return { record, formEncoded: true };
    } catch {
      return null;
    }
  }

  try {
    const payload: unknown = await request.json();
    const record =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};
    return { record, formEncoded: false };
  } catch {
    return null;
  }
}

/**
 * Canonicalise hostnames before comparing them.
 *
 * Cloudflare reports no port, while local configuration is frequently written
 * as either `localhost`, `127.0.0.1:3000`, or a complete local origin. Treat
 * loopback spellings as the same machine, and normalize case/trailing dots.
 */
function canonicalHostname(hostname: string): string | null {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  if (!normalized || normalized.includes("*")) return null;
  return LOOPBACK_HOSTNAMES.has(normalized) ? LOCALHOST : normalized;
}

function configuredHostname(value: string): string | null {
  const entry = sanitizeTurnstileEnvValue(value);
  if (!entry || entry.includes("*")) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(entry) ? entry : `http://${entry}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return canonicalHostname(url.hostname);
  } catch {
    return null;
  }
}

function originHostname(value: string): string | null {
  const entry = sanitizeTurnstileEnvValue(value);
  if (!entry || entry.includes("*")) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(entry) ? entry : `https://${entry}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return canonicalHostname(url.hostname);
  } catch {
    return null;
  }
}

function providerHostname(value: unknown): string | null {
  if (typeof value !== "string" || /[\s/@*]/.test(value)) return null;
  // Siteverify returns a hostname, never an origin or host:port. Colons are
  // accepted only for the loopback IPv6 forms canonicalHostname knows about.
  const normalized = canonicalHostname(value);
  if (!normalized) return null;
  if (normalized.includes(":") && normalized !== LOCALHOST) return null;
  return normalized;
}

function isIpLiteral(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

/**
 * For custom root domains derived from site URL configuration (`mukra.com` or
 * `www.mukra.com`), accept both apex and `www.` so visitors on either canonical
 * entrypoint verify cleanly. Never expand multi-tenant platform suffixes or
 * arbitrary 3+-label subdomains (`shop.example.com`).
 */
function customDomainVariants(hostname: string): string[] {
  if (
    hostname === LOCALHOST ||
    isIpLiteral(hostname) ||
    SHARED_PLATFORM_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    return [hostname];
  }
  if (hostname.startsWith("www.")) {
    const apex = hostname.slice(4);
    if (apex.split(".").length === 2) return [hostname, apex];
    return [hostname];
  }
  if (hostname.split(".").length === 2) {
    return [hostname, `www.${hostname}`];
  }
  return [hostname];
}

let loopbackStripWarned = false;

function stripLoopbackInCloudProduction(hosts: Set<string>): void {
  if (process.env.NODE_ENV !== "production" || !hosts.has(LOCALHOST)) return;
  const hasRealDomain = hosts.size > 1;
  const isCloudProd = process.env.VERCEL_ENV === "production" || process.env.CF_PAGES === "1";
  if (!hasRealDomain && !isCloudProd) return;
  hosts.delete(LOCALHOST);
  if (!loopbackStripWarned) {
    loopbackStripWarned = true;
    console.warn("[turnstile] Ignoring loopback hostname in production Turnstile allowlist.");
  }
}

function trustedPlatformProxyHost(headers?: Headers | null): string | null {
  if (!headers) return null;
  const raw =
    headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headers.get("host")?.trim();
  if (!raw) return null;
  return configuredHostname(raw);
}

function allowedHostnames(requestHeaders?: Headers | null): Set<string> {
  const hosts = new Set<string>();
  const explicit =
    sanitizeTurnstileEnvValue(process.env.TURNSTILE_ALLOWED_HOSTNAMES, "TURNSTILE_ALLOWED_HOSTNAMES") ||
    sanitizeTurnstileEnvValue(process.env.TURNSTILE_HOSTNAMES, "TURNSTILE_HOSTNAMES");

  if (explicit) {
    for (const entry of explicit.split(",")) {
      const hostname = configuredHostname(entry);
      if (hostname) hosts.add(hostname);
    }
    stripLoopbackInCloudProduction(hosts);
  } else {
    const configuredOrigins = [
      process.env.AUTH_URL,
      process.env.NEXTAUTH_URL,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
      process.env.VERCEL_BRANCH_URL,
      process.env.VERCEL_URL,
      process.env.CF_PAGES_URL,
    ];
    for (const origin of configuredOrigins) {
      if (!origin) continue;
      const hostname = originHostname(origin);
      if (!hostname) continue;
      for (const variant of customDomainVariants(hostname)) {
        hosts.add(variant);
      }
    }

    // On managed edge platforms (Vercel, Cloudflare Pages) or explicitly trusted
    // reverse proxies, x-forwarded-host is set by the platform router for
    // verified project aliases (such as `<project>-<team>.vercel.app`).
    if (
      process.env.VERCEL === "1" ||
      process.env.CF_PAGES === "1" ||
      process.env.AUTH_TRUST_HOST === "true"
    ) {
      const proxyHost = trustedPlatformProxyHost(requestHeaders);
      if (proxyHost && (process.env.NODE_ENV !== "production" || proxyHost !== LOCALHOST)) {
        for (const variant of customDomainVariants(proxyHost)) {
          hosts.add(variant);
        }
      }
    }

    stripLoopbackInCloudProduction(hosts);
  }

  // An explicit production allowlist still takes precedence. In non-production,
  // loopback spellings and sandbox preview hosts are permitted locally.
  if (process.env.NODE_ENV !== "production") {
    hosts.add(LOCALHOST);
    const previewHost = trustedPlatformProxyHost(requestHeaders);
    if (previewHost && (previewHost.endsWith(".e2b.app") || previewHost.endsWith(".e2b.dev"))) {
      hosts.add(previewHost);
    }
  }
  return hosts;
}

function resolveRemoteIp(
  remoteIp?: string | null,
  headers?: Headers | null,
): string | null {
  const candidate =
    remoteIp?.trim() ||
    headers?.get("cf-connecting-ip")?.trim() ||
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers?.get("x-real-ip")?.trim() ||
    "";
  if (!candidate || candidate === "anonymous" || candidate.length > 64) return null;
  if (!/^[a-fA-F0-9:.]+$/.test(candidate)) return null;
  return candidate;
}

function isOfficialLocalTestConfiguration(secret: string): boolean {
  const rawPublicKey = sanitizeTurnstileEnvValue(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  );
  return (
    process.env.NODE_ENV !== "production" &&
    secret === TURNSTILE_ALWAYS_PASS_TEST_SECRET &&
    TURNSTILE_TEST_SITE_KEYS.has(rawPublicKey)
  );
}

export interface TurnstileRejectionDiagnostic {
  expectedAction?: TurnstileAction;
  receivedAction?: string;
  hostname?: string;
  allowedHostnames?: string[];
  errorCodes?: string[];
  messages?: string[];
  challengeTs?: string;
  httpStatus?: number;
  secretLength?: number;
  looksLikeSiteKey?: boolean;
  tokenLength?: number;
  remoteIpIncluded?: boolean;
  errorName?: string;
  hint?: string;
}

function describeTurnstileErrorCodes(
  errorCodes?: string[],
  looksLikeSiteKey?: boolean,
): string | undefined {
  if (!errorCodes || errorCodes.length === 0) {
    return looksLikeSiteKey
      ? "TURNSTILE_SECRET_KEY is 24 chars (matches a public Site Key, not a 35-char Secret Key) — check if keys were swapped."
      : undefined;
  }
  const hints: string[] = [];
  for (const code of errorCodes) {
    switch (code) {
      case "missing-input-secret":
        hints.push("Secret parameter was empty in siteverify request — verify TURNSTILE_SECRET_KEY.");
        break;
      case "invalid-input-secret":
        hints.push(
          looksLikeSiteKey
            ? "TURNSTILE_SECRET_KEY is 24 chars (looks like a public Site Key, not a 35-char Secret Key) — verify TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY were not swapped."
            : "TURNSTILE_SECRET_KEY was rejected by Cloudflare — verify it matches the active 35-character Secret Key for this widget in Cloudflare Dashboard.",
        );
        break;
      case "missing-input-response":
        hints.push("Turnstile response token was empty when posted to siteverify.");
        break;
      case "invalid-input-response":
        hints.push(
          "Turnstile response token is invalid, malformed, or was issued for a different widget Site Key.",
        );
        break;
      case "timeout-or-duplicate":
        hints.push(
          "Turnstile token expired (5-minute TTL) or was already consumed (tokens are single-use).",
        );
        break;
      case "bad-request":
        hints.push("Cloudflare rejected the siteverify request format.");
        break;
      case "internal-error":
        hints.push("Cloudflare Turnstile reported an internal verification error.");
        break;
      default:
        break;
    }
  }
  return hints.length > 0 ? hints.join(" ") : undefined;
}

function extractSafeErrorCodes(verdict: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(verdict["error-codes"])) return undefined;
  const codes = verdict["error-codes"]
    .filter((code): code is string => typeof code === "string" && /^[a-z0-9_-]{1,64}$/i.test(code))
    .slice(0, 8);
  return codes.length > 0 ? codes : undefined;
}

function extractSafeMessages(verdict: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(verdict.messages)) return undefined;
  const messages = verdict.messages
    .filter((msg): msg is string => typeof msg === "string" && msg.trim().length > 0)
    .map((msg) => msg.trim().slice(0, 160))
    .slice(0, 4);
  return messages.length > 0 ? messages : undefined;
}

function rejected(
  reason: TurnstileFailureReason,
  diagnostic: TurnstileRejectionDiagnostic = {},
): false {
  // Never log tokens, secrets, passwords, emails, or client IPs.
  // Emit structured JSON at error level so Vercel Runtime Logs surfaces exact
  // Cloudflare `error-codes` (e.g. `invalid-input-secret`, `timeout-or-duplicate`).
  const cleanDiagnostic = Object.fromEntries(
    Object.entries(diagnostic).filter(([, value]) => value !== undefined),
  );
  console.error(
    `[turnstile] Verification rejected: ${reason}`,
    JSON.stringify({ reason, ...cleanDiagnostic }),
  );
  return false;
}

let devBypassWarningLogged = false;

/** Fail closed on missing configuration, bad data, outages and replays. */
export async function verifyTurnstileToken(
  token: unknown,
  options: VerifyTurnstileOptions,
): Promise<boolean> {
  if (isTurnstileBypassed()) {
    if (!devBypassWarningLogged) {
      devBypassWarningLogged = true;
      console.warn(
        "[turnstile] LOCAL DEVELOPMENT bypass active (TURNSTILE_DEV_BYPASS=true). Production builds always enforce siteverify.",
      );
    }
    return true;
  }

  const candidate =
    typeof token === "string"
      ? cleanTokenCandidate(token)
      : token && typeof token === "object" && !Array.isArray(token)
        ? extractTurnstileToken(token, options.requestHeaders)
        : token === undefined
          ? extractTurnstileToken(null, options.requestHeaders)
          : token;
  if (typeof candidate !== "string") {
    return rejected("invalid-token", {
      expectedAction: options.action,
      tokenLength: 0,
      hint: "No string cf-turnstile-response token was present in the request payload or headers.",
    });
  }
  const normalizedToken = cleanTokenCandidate(candidate);
  if (!normalizedToken || normalizedToken.length > 2048) {
    return rejected("invalid-token", {
      expectedAction: options.action,
      tokenLength: normalizedToken.length,
      hint:
        normalizedToken.length === 0
          ? "cf-turnstile-response token was empty."
          : "cf-turnstile-response token exceeded Cloudflare's 2048-character maximum.",
    });
  }

  const { secret, error: secretError, looksLikeSiteKey } = readTurnstileSecretKey();
  if (secretError === "missing-secret") {
    return rejected("missing-secret", {
      expectedAction: options.action,
      hint: "TURNSTILE_SECRET_KEY is unset or empty after stripping quotes/whitespace.",
    });
  }
  if (secretError === "invalid-secret-format" || !secret) {
    return rejected("invalid-secret-format", {
      expectedAction: options.action,
      hint: "TURNSTILE_SECRET_KEY contains invalid whitespace or non-key boundary characters.",
    });
  }
  if (process.env.NODE_ENV === "production" && TURNSTILE_TEST_SECRETS.has(secret)) {
    return rejected("test-secret-in-production", {
      expectedAction: options.action,
      secretLength: secret.length,
      hint: "Cloudflare dummy test secrets are blocked in production; configure the real widget Secret Key.",
    });
  }
  if (looksLikeSiteKey) {
    console.error(
      "[turnstile] TURNSTILE_SECRET_KEY has length 24 (matches a public Turnstile Site Key rather than a 35-character Secret Key). Verify TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY were not swapped.",
    );
  }

  const hosts = allowedHostnames(options.requestHeaders);
  if (!hosts.size) {
    return rejected("missing-hostname-configuration", {
      expectedAction: options.action,
      hint: "Set AUTH_URL, NEXTAUTH_URL, NEXT_PUBLIC_SITE_URL, or TURNSTILE_ALLOWED_HOSTNAMES for hostname verification.",
    });
  }

  const remoteIp = resolveRemoteIp(options.remoteIp, options.requestHeaders);
  const params = new URLSearchParams({
    secret,
    response: normalizedToken,
    ...(remoteIp ? { remoteip: remoteIp } : {}),
  });

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const errorBody: unknown = await response.json().catch(() => null);
      const errorRecord =
        errorBody && typeof errorBody === "object" && !Array.isArray(errorBody)
          ? (errorBody as Record<string, unknown>)
          : null;
      const errorCodes = errorRecord ? extractSafeErrorCodes(errorRecord) : undefined;
      const messages = errorRecord ? extractSafeMessages(errorRecord) : undefined;
      return rejected("provider-http-error", {
        expectedAction: options.action,
        httpStatus: response.status,
        errorCodes,
        messages,
        secretLength: secret.length,
        looksLikeSiteKey: looksLikeSiteKey || undefined,
        tokenLength: normalizedToken.length,
        remoteIpIncluded: Boolean(remoteIp),
        hint: describeTurnstileErrorCodes(errorCodes, looksLikeSiteKey),
      });
    }

    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return rejected("invalid-provider-response", {
        expectedAction: options.action,
        httpStatus: response.status,
        tokenLength: normalizedToken.length,
      });
    }

    const verdict = result as Record<string, unknown>;
    const errorCodes = extractSafeErrorCodes(verdict);
    const messages = extractSafeMessages(verdict);
    const receivedAction =
      typeof verdict.action === "string" ? verdict.action.slice(0, 64) : undefined;
    const rawHostname =
      typeof verdict.hostname === "string" ? verdict.hostname.slice(0, 253) : undefined;
    const challengeTs =
      typeof verdict.challenge_ts === "string" ? verdict.challenge_ts.slice(0, 64) : undefined;

    if (verdict.success !== true) {
      return rejected("provider-rejected-token", {
        expectedAction: options.action,
        receivedAction,
        hostname: rawHostname,
        errorCodes,
        messages,
        challengeTs,
        secretLength: secret.length,
        looksLikeSiteKey: looksLikeSiteKey || undefined,
        tokenLength: normalizedToken.length,
        remoteIpIncluded: Boolean(remoteIp),
        hint: describeTurnstileErrorCodes(errorCodes, looksLikeSiteKey),
      });
    }

    const officialLocalTest = isOfficialLocalTestConfiguration(secret);
    // The official test widget may return provider-static `test` metadata (or
    // omit action) and static `example.com` hostname instead of echoing local
    // metadata. Permit only that metadata with the exact public test site/secret
    // pair outside production.
    const actionMatches =
      verdict.action === options.action ||
      (officialLocalTest &&
        (verdict.action === "test" || verdict.action === undefined || verdict.action === null));
    if (!actionMatches) {
      return rejected("action-mismatch", {
        expectedAction: options.action,
        receivedAction,
        hostname: rawHostname,
        challengeTs,
        hint: `Cloudflare token action "${receivedAction ?? "<empty>"}" did not match expected action "${options.action}".`,
      });
    }

    const hostname = providerHostname(verdict.hostname);
    const hostnameMatches =
      Boolean(hostname && hosts.has(hostname)) ||
      (officialLocalTest && hostname === "example.com");
    if (!hostnameMatches) {
      return rejected("hostname-mismatch", {
        expectedAction: options.action,
        receivedAction,
        hostname: rawHostname,
        allowedHostnames: [...hosts],
        challengeTs,
        hint: `Cloudflare verified token for hostname "${rawHostname ?? "<empty>"}", which is not in server allowlist [${[...hosts].join(", ")}].`,
      });
    }
    return true;
  } catch (err) {
    // Never log tokens, keys, provider response bodies, or request details.
    return rejected("provider-unavailable", {
      expectedAction: options.action,
      errorName: err instanceof Error ? err.name : "UnknownError",
      hint: "Network error or 10s timeout reaching https://challenges.cloudflare.com/turnstile/v0/siteverify.",
    });
  }
}

/** Server-only configuration readiness; deliberately does not reveal any key/hostname. */
export function isTurnstileServerConfigured(): boolean {
  if (isTurnstileBypassed()) return true;
  const { secret, error } = readTurnstileSecretKey();
  return (
    error === null &&
    Boolean(secret) &&
    !(process.env.NODE_ENV === "production" && TURNSTILE_TEST_SECRETS.has(secret)) &&
    allowedHostnames().size > 0
  );
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
  if (configurationWarningLogged || isTurnstileBypassed()) return;
  const publicKey = getTurnstileSiteKey();
  const { secret, error } = readTurnstileSecretKey();
  if (publicKey && error === null && secret && isTurnstileServerConfigured()) return;
  configurationWarningLogged = true;
  const missing = [
    !publicKey ? "NEXT_PUBLIC_TURNSTILE_SITE_KEY" : null,
    error !== null || !secret ? "TURNSTILE_SECRET_KEY" : null,
    allowedHostnames().size === 0 ? "TURNSTILE_ALLOWED_HOSTNAMES" : null,
    process.env.NODE_ENV === "production" && secret && TURNSTILE_TEST_SECRETS.has(secret)
      ? "production Turnstile secret"
      : null,
  ].filter((name): name is string => Boolean(name));
  console.error(
    `[turnstile] Security verification is not fully configured (missing or invalid: ${missing.join(", ")}). ` +
      "Authentication submissions stay disabled until the Turnstile widget is available.",
  );
}
