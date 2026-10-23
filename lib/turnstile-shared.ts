/** Safe to import in the browser. Secret/configuration access stays in lib/turnstile.ts. */
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFR9W3cd66AOTr2B";
export const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";
export const TURNSTILE_ERROR = "Security verification failed. Please try again.";
export type TurnstileAction = "login" | "register" | "review" | "resend_verification";

/** All environments exercise the real widget and server verification. */
export function isTurnstileBypassed(): boolean {
  return false;
}
