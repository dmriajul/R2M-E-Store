import type { TurnstileAction } from "@/lib/turnstile-shared";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function allowedHostnames(): Set<string> {
  const explicit = process.env.TURNSTILE_ALLOWED_HOSTNAMES?.trim();
  if (explicit) {
    return new Set(explicit.split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));
  }
  const hosts = new Set<string>();
  for (const origin of [process.env.AUTH_URL, process.env.NEXTAUTH_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    if (!origin) continue;
    try {
      const url = new URL(origin);
      if (["https:", "http:"].includes(url.protocol)) hosts.add(url.hostname.toLowerCase());
    } catch { /* Invalid configured origins are never trusted. */ }
  }
  if (process.env.NODE_ENV !== "production") {
    hosts.add("localhost");
    hosts.add("127.0.0.1");
  }
  return hosts;
}

/** Server-only call sites. Missing configuration, outages, bad data and replays fail closed. */
export async function verifyTurnstileToken(
  token: unknown,
  options: { action: TurnstileAction },
): Promise<boolean> {
  if (typeof token !== "string" || !token.trim() || token.length > 2048) return false;
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return false;
  const hosts = allowedHostnames();
  if (!hosts.size) return false;

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token.trim() }).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const result: unknown = await response.json();
    if (!result || typeof result !== "object") return false;
    return "success" in result && result.success === true &&
      "action" in result && result.action === options.action &&
      "hostname" in result && typeof result.hostname === "string" &&
      hosts.has(result.hostname.toLowerCase());
  } catch {
    // Never log tokens, keys, provider response bodies, or request details.
    return false;
  }
}

/** Server-only configuration readiness; deliberately does not reveal any key/hostname. */
export function isTurnstileServerConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim()) && allowedHostnames().size > 0;
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
  if (publicKey && secret && allowedHostnames().size > 0) return;
  configurationWarningLogged = true;
  const missing = [
    !publicKey ? "NEXT_PUBLIC_TURNSTILE_SITE_KEY" : null,
    !secret ? "TURNSTILE_SECRET_KEY" : null,
    allowedHostnames().size === 0 ? "TURNSTILE_ALLOWED_HOSTNAMES" : null,
  ].filter((name): name is string => Boolean(name));
  console.warn(
    `[turnstile] Security verification is not fully configured (missing: ${missing.join(", ")}). ` +
      "Authentication submissions stay disabled until the Turnstile widget is available.",
  );
}
