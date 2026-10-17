import { TURNSTILE_ERROR } from "@/lib/turnstile-shared";

/** Public, fixed copy only. Never render raw database/provider errors. */
export const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: "Invalid email or password. Please try again.",
  EMAIL_NOT_VERIFIED: "Please verify your email address before logging in. Check your inbox.",
  ACCOUNT_LOCKED: "Too many failed attempts. Please try again later or reset your password.",
  SERVER_ERROR: "Something went wrong. Please try again later.",
  EMAIL_ALREADY_EXISTS: "An account with this email already exists. Please login or use a different email.",
  INVALID_EMAIL: "Please enter a valid email address.",
  EMAIL_REQUIRED: "Email is required",
  PASSWORD_REQUIRED: "Password is required",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
  WEAK_PASSWORD: "Password must be at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character.",
  PASSWORD_TOO_LONG: "Password is too long. Use at most 72 UTF-8 bytes when creating an account.",
  PASSWORD_MISMATCH: "Passwords do not match. Please try again.",
  CONFIRM_PASSWORD_REQUIRED: "Please confirm your password.",
  REQUIRED_FIELDS: "Please fill in all required fields.",
  INVALID_NAME: "Please enter your full name using 3 to 80 characters.",
  INVALID_PHONE: "Please enter a valid phone number.",
  TERMS_REQUIRED: "Please accept the Terms & Privacy Policy.",
  INVALID_REQUEST: "Please check your details and try again.",
  // Compatibility names retained for consumers introduced on the base branch.
  MISSING_FIELDS: "Please fill in all required fields.",
  RATE_LIMITED: "Too many failed attempts. Please try again later or reset your password.",
  SECURITY_CHECK_FAILED: TURNSTILE_ERROR,
} as const;
export const AUTH_SUCCESS_MESSAGES = {
  SIGNED_IN: "Welcome back!",
  ACCOUNT_CREATED: "Account created. Please check your inbox to verify your email.",
} as const;
export type AuthErrorCode = keyof typeof AUTH_MESSAGES;
export type AuthField = "email" | "password" | "name" | "phone" | "confirmPassword" | "acceptedTerms";
export interface AuthApiFailure {
  success: false;
  data: null;
  code: AuthErrorCode;
  error: AuthErrorCode;
  fieldErrors?: Partial<Record<AuthField, AuthErrorCode>>;
}
export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return typeof value === "string" && Object.hasOwn(AUTH_MESSAGES, value);
}
export function authErrorMessage(code: unknown): string {
  return isAuthErrorCode(code) ? AUTH_MESSAGES[code] : AUTH_MESSAGES.SERVER_ERROR;
}
export const LOGIN_CODES = {
  "invalid-credentials": "INVALID_CREDENTIALS",
  "account-service-unavailable": "SERVER_ERROR",
  "too-many-attempts": "ACCOUNT_LOCKED",
  "security-verification-failed": "SECURITY_CHECK_FAILED",
  "email-not-verified": "EMAIL_NOT_VERIFIED",
} as const satisfies Record<string, AuthErrorCode>;
export type LoginFailure = keyof typeof LOGIN_CODES;
export const LOGIN_MESSAGES = Object.fromEntries(Object.entries(LOGIN_CODES).map(([code, key]) => [code, AUTH_MESSAGES[key]])) as Record<LoginFailure, string>;
export function loginErrorCode(code: string | undefined): AuthErrorCode {
  return code && Object.hasOwn(LOGIN_CODES, code) ? LOGIN_CODES[code as LoginFailure] : "SERVER_ERROR";
}
export function loginErrorMessage(code: string | undefined): string {
  return AUTH_MESSAGES[loginErrorCode(code)];
}
export function isAuthWarning(code: AuthErrorCode): boolean {
  return code === "EMAIL_NOT_VERIFIED" || code === "ACCOUNT_LOCKED" || code === "RATE_LIMITED";
}
