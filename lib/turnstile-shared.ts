/** Safe to import in the browser. Secret/configuration access stays in lib/turnstile.ts. */
export const TURNSTILE_ERROR = "Security verification failed. Please try again.";
export type TurnstileAction = "login" | "register" | "review" | "resend_verification";
