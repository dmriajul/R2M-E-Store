/** Safe to import in the browser. Secret/configuration access stays in lib/turnstile.ts. */
export const TURNSTILE_ERROR = "Security verification failed. Please try again.";
export type TurnstileAction = "login" | "register" | "review" | "resend_verification";

/**
 * Local-development CAPTCHA escape hatch.
 *
 * `next dev` sets NODE_ENV=development; `next build`/`next start` and the test
 * runner never do. Next.js inlines NODE_ENV in both the browser and server
 * bundles, so a production build cannot enable this at runtime. Both the form
 * gating and the server-side Siteverify call consult this single predicate —
 * development never blocks on Cloudflare, production always verifies.
 */
export function isTurnstileBypassed(): boolean {
  return process.env.NODE_ENV === "development";
}
