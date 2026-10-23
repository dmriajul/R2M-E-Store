/** Safe to import in the browser. Secret/configuration access stays in lib/turnstile.ts. */
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFR9W3cd66AOTr2B";
export const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";
export const TURNSTILE_ERROR = "Security verification failed. Please try again.";
export type TurnstileAction = "login" | "register" | "review" | "resend_verification";

/**
 * Resolve the public Turnstile site key.
 *
 * Uses `NEXT_PUBLIC_TURNSTILE_SITE_KEY` when non-empty and falls back to the
 * store's configured Cloudflare widget key (`0x4AAAAAAFR9W3cd66AOTr2B`) so an
 * empty or omitted build env var never prevents the widget from mounting.
 * Passing an explicit `siteKey` string (including `""` in unit tests) overrides
 * environment lookup.
 */
export function getTurnstileSiteKey(explicitSiteKey?: string): string {
  if (explicitSiteKey !== undefined) return explicitSiteKey.trim();
  const configured = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return configured || TURNSTILE_SITE_KEY;
}

/**
 * Explicit opt-in development-only CAPTCHA bypass (`next dev` ONLY).
 *
 * Never active when `NODE_ENV === "production"` or `"test"`, even if the env
 * variable is accidentally present.
 */
export function isTurnstileBypassed(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    (process.env.NEXT_PUBLIC_TURNSTILE_DEV_BYPASS === "true" ||
      process.env.TURNSTILE_DEV_BYPASS === "true")
  );
}
