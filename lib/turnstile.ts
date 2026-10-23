import { TURNSTILE_RESPONSE_FIELD, type TurnstileAction } from "@/lib/turnstile-shared";

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
] as const;

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

export interface VerifyTurnstileOptions {
  action: TurnstileAction;
  remoteIp?: string | null;
  requestHeaders?: Headers | null;
}

/**
 * Extract the Turnstile response token from a parsed request payload or form.
 *
 * Canonical `cf-turnstile-response` takes precedence, with `turnstileToken`
 * retained so existing API/NextAuth callers remain compatible.
 */
export function extractTurnstileToken(
  payload: unknown,
  headers?: Headers | null,
): unknown {
  if (payload instanceof FormData || payload instanceof URLSearchParams) {
    let firstDefined: unknown = undefined;
    for (const field of TURNSTILE_TOKEN_FIELDS) {
      const value = payload.get(field);
      if (value === null) continue;
      if (firstDefined === undefined) firstDefined = value;
      if (typeof value === "string" && value.trim().length > 0) return value;
    }
    if (firstDefined !== undefined) return firstDefined;
  } else if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    let firstDefined: unknown = undefined;
    for (const field of TURNSTILE_TOKEN_FIELDS) {
      if (!Object.hasOwn(record, field)) continue;
      const value = record[field];
      if (value === undefined) continue;
      if (firstDefined === undefined) firstDefined = value;
      if (typeof value === "string" && value.trim().length > 0) return value;
    }
    if (firstDefined !== undefined) return firstDefined;
  }

  const headerToken = headers?.get(TURNSTILE_RESPONSE_FIELD)?.trim();
  if (headerToken) return headerToken;
  return undefined;
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
  const entry = value.trim();
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
  const entry = value.trim();
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
    process.env.TURNSTILE_ALLOWED_HOSTNAMES?.trim() ||
    process.env.TURNSTILE_HOSTNAMES?.trim();

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
  // Never log tokens or secrets. Production needs rejection reasons too.
  console.warn(`[turnstile] Verification rejected: ${reason}.`, diagnostic ?? "");
  return false;
}

/** Fail closed on missing configuration, bad data, outages and replays. */
export async function verifyTurnstileToken(
  token: unknown,
  options: VerifyTurnstileOptions,
): Promise<boolean> {
  if (typeof token !== "string") return rejected("invalid-token");
  const normalizedToken = token.trim();
  if (!normalizedToken || normalizedToken.length > 2048) return rejected("invalid-token");

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return rejected("missing-secret");
  if (process.env.NODE_ENV === "production" && TURNSTILE_TEST_SECRETS.has(secret)) {
    return rejected("test-secret-in-production");
  }

  const hosts = allowedHostnames(options.requestHeaders);
  if (!hosts.size) return rejected("missing-hostname-configuration");

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
    if (!response.ok) return rejected("provider-http-error");

    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return rejected("invalid-provider-response");
    }
    const verdict = result as Record<string, unknown>;
    const diagnostic: SafeProviderDiagnostic = {
      errorCodes: Array.isArray(verdict["error-codes"])
        ? verdict["error-codes"].filter((code): code is string =>
          typeof code === "string" && /^[a-z0-9_-]{1,64}$/i.test(code),
        ).slice(0, 8)
        : undefined,
      action: typeof verdict.action === "string" ? verdict.action.slice(0, 64) : undefined,
      hostname: typeof verdict.hostname === "string" ? verdict.hostname.slice(0, 253) : undefined,
    };
    if (verdict.success !== true) return rejected("provider-rejected-token", diagnostic);

    const officialLocalTest = isOfficialLocalTestConfiguration(secret);
    // The official test widget may return provider-static `test` metadata (or
    // omit action) and static `example.com` hostname instead of echoing local
    // metadata. Permit only that metadata with the exact public test site/secret
    // pair outside production.
    const actionMatches = verdict.action === options.action ||
      (officialLocalTest && (verdict.action === "test" || verdict.action === undefined || verdict.action === null));
    if (!actionMatches) return rejected("action-mismatch", diagnostic);

    const hostname = providerHostname(verdict.hostname);
    const hostnameMatches =
      Boolean(hostname && hosts.has(hostname)) ||
      (officialLocalTest && hostname === "example.com");
    if (!hostnameMatches) return rejected("hostname-mismatch", diagnostic);
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
  console.error(
    `[turnstile] Security verification is not fully configured (missing or invalid: ${missing.join(", ")}). ` +
      "Authentication submissions stay disabled until the Turnstile widget is available.",
  );
}
