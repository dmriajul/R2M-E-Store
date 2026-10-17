import { z } from "zod";
import { AUTH_MESSAGES, LOGIN_CODES, authErrorMessage, isAuthErrorCode, isAuthWarning, type AuthErrorCode, type AuthField } from "@/lib/auth-messages";

export const AUTH_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const authEmailSchema = z.string({ required_error: AUTH_MESSAGES.EMAIL_REQUIRED, invalid_type_error: AUTH_MESSAGES.INVALID_EMAIL })
  .trim().min(1, AUTH_MESSAGES.EMAIL_REQUIRED).max(254, AUTH_MESSAGES.INVALID_EMAIL)
  .email(AUTH_MESSAGES.INVALID_EMAIL).regex(AUTH_EMAIL_REGEX, AUTH_MESSAGES.INVALID_EMAIL)
  .transform((email) => email.toLowerCase());

export const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "One number", test: (value: string) => /\d/.test(value) },
  { label: "One special character", test: (value: string) => /[^A-Za-z0-9\s]/.test(value) },
] as const;
export function scorePassword(value: string): number { return PASSWORD_RULES.filter((rule) => rule.test(value)).length; }
// Passwords are NEVER trimmed, case-normalized, or HTML-sanitized.
const requiredPassword = z.string({ required_error: AUTH_MESSAGES.PASSWORD_REQUIRED, invalid_type_error: AUTH_MESSAGES.PASSWORD_REQUIRED }).min(1, AUTH_MESSAGES.PASSWORD_REQUIRED);
export const registrationPasswordSchema = requiredPassword
  .refine((value) => !value || PASSWORD_RULES.every((rule) => rule.test(value)), AUTH_MESSAGES.WEAK_PASSWORD)
  .refine((value) => new TextEncoder().encode(value).length <= 72, AUTH_MESSAGES.PASSWORD_TOO_LONG);
export const loginSchema = z.object({
  email: authEmailSchema,
  password: requiredPassword, // Existing credentials must not inherit new-registration strength rules.
  remember: z.boolean(),
});
export type LoginValues = z.infer<typeof loginSchema>;
const nameSchema = z.string({ required_error: AUTH_MESSAGES.REQUIRED_FIELDS }).trim()
  .min(1, AUTH_MESSAGES.REQUIRED_FIELDS).min(3, AUTH_MESSAGES.INVALID_NAME).max(80, AUTH_MESSAGES.INVALID_NAME)
  .refine((value) => !/[\u0000-\u001f\u007f<>]/.test(value), AUTH_MESSAGES.INVALID_NAME);
const phoneSchema = z.string().trim().regex(/^[+()\-\s0-9]{7,20}$/, AUTH_MESSAGES.INVALID_PHONE).optional().or(z.literal(""));
const confirmation = z.string({ required_error: AUTH_MESSAGES.CONFIRM_PASSWORD_REQUIRED }).min(1, AUTH_MESSAGES.CONFIRM_PASSWORD_REQUIRED);
export const registerSchema = z.object({
  fullName: nameSchema, email: authEmailSchema, phone: phoneSchema,
  password: registrationPasswordSchema, confirmPassword: confirmation,
  acceptedTerms: z.boolean().refine(Boolean, AUTH_MESSAGES.TERMS_REQUIRED),
}).refine((values) => values.password === values.confirmPassword, { path: ["confirmPassword"], message: AUTH_MESSAGES.PASSWORD_MISMATCH });
export type RegisterValues = z.infer<typeof registerSchema>;
// Keep existing API consumers compatible; the new UI always sends confirmation.
export const registerApiSchema = z.object({
  name: nameSchema, email: authEmailSchema, phone: phoneSchema, password: registrationPasswordSchema,
  confirmPassword: confirmation.optional(),
  acceptedTerms: z.boolean().refine(Boolean, AUTH_MESSAGES.TERMS_REQUIRED).optional(),
}).refine((values) => values.confirmPassword === undefined || values.password === values.confirmPassword,
  { path: ["confirmPassword"], message: AUTH_MESSAGES.PASSWORD_MISMATCH });
export type RegisterApiValues = z.infer<typeof registerApiSchema>;

/** Only whitelisted field names/codes leave the API; no input values or raw Zod/provider data. */
export function authValidationErrors(error: z.ZodError): { code: AuthErrorCode; fieldErrors: Partial<Record<AuthField, AuthErrorCode>> } {
  const fieldErrors: Partial<Record<AuthField, AuthErrorCode>> = {};
  const fields: readonly string[] = ["email", "password", "name", "phone", "confirmPassword", "acceptedTerms"];
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || !fields.includes(field) || fieldErrors[field as AuthField]) continue;
    const entry = Object.entries(AUTH_MESSAGES).find(([, message]) => message === issue.message);
    fieldErrors[field as AuthField] = entry ? entry[0] as AuthErrorCode : "REQUIRED_FIELDS";
  }
  const codes = Object.values(fieldErrors);
  return { code: codes.includes("EMAIL_REQUIRED") || codes.includes("PASSWORD_REQUIRED") || codes.includes("REQUIRED_FIELDS")
    ? "REQUIRED_FIELDS" : codes[0] ?? "INVALID_REQUEST", fieldErrors };
}


/* Base-branch API compatibility. All schemas/copy above remain the single source of truth. */
export type { AuthErrorCode } from "@/lib/auth-messages";
export const AUTH_ERROR_CODES = Object.fromEntries(Object.keys(AUTH_MESSAGES).map((code) => [code, code])) as { [Code in AuthErrorCode]: Code };
export const EMAIL_REGEX = AUTH_EMAIL_REGEX;
export const PHONE_REGEX = /^[+()\-\s0-9]{7,20}$/;
export const PASSWORD_MIN_LENGTH = 8;

/** Legacy helpers for non-password text; schema validation still rejects invalid input. */
export function sanitizeInput(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFC").replace(/[\u0000-\u001f\u007f<>]/g, "").trim() : "";
}
export function sanitizeEmail(value: unknown): string {
  // Do not turn a malformed address into a different valid account address.
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
export function sanitizePhone(value: unknown): string { return sanitizeInput(value); }
export function isValidEmail(email: string): boolean { return authEmailSchema.safeParse(email).success; }
export function validateEmail(email: string): { valid: boolean; sanitized: string; code?: AuthErrorCode; error?: string } {
  const sanitized = sanitizeEmail(email);
  if (!sanitized) return { valid: false, sanitized, code: "MISSING_FIELDS", error: AUTH_MESSAGES.EMAIL_REQUIRED };
  if (!isValidEmail(sanitized)) return { valid: false, sanitized, code: "INVALID_EMAIL", error: AUTH_MESSAGES.INVALID_EMAIL };
  return { valid: true, sanitized };
}
export interface PasswordStrengthResult {
  valid: boolean;
  /** 0–5, matching the five shared registration rules and current strength meter. */
  score: number;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  code?: AuthErrorCode;
  error?: string;
}
export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const parsed = registrationPasswordSchema.safeParse(password);
  const code: AuthErrorCode = !password ? "MISSING_FIELDS" : new TextEncoder().encode(password).length > 72 ? "PASSWORD_TOO_LONG" : "WEAK_PASSWORD";
  return { valid: parsed.success, score: scorePassword(password), hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password), hasLowercase: /[a-z]/.test(password), hasNumber: /\d/.test(password),
    hasSpecialChar: /[^A-Za-z0-9\s]/.test(password),
    ...(!parsed.success ? { code, error: !password ? AUTH_MESSAGES.PASSWORD_REQUIRED : AUTH_MESSAGES[code] } : {}) };
}
/** Compatibility byte comparison, not used for password authentication (bcrypt only). */
export function constantTimeCompare(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index++) diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return diff === 0;
}
export const forgotPasswordSchema = z.object({ email: authEmailSchema });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export interface AuthErrorCopy {
  code: AuthErrorCode;
  title: string;
  message: string;
  severity: "error" | "warning";
  field?: "fullName" | "email" | "phone" | "password" | "confirmPassword";
}
const errorFields: Partial<Record<AuthErrorCode, AuthErrorCopy["field"]>> = {
  EMAIL_NOT_VERIFIED: "email", EMAIL_ALREADY_EXISTS: "email", INVALID_EMAIL: "email", EMAIL_REQUIRED: "email",
  INVALID_NAME: "fullName", INVALID_PHONE: "phone", WEAK_PASSWORD: "password", PASSWORD_TOO_LONG: "password",
  PASSWORD_REQUIRED: "password", PASSWORD_MISMATCH: "confirmPassword", CONFIRM_PASSWORD_REQUIRED: "confirmPassword",
};
function errorCopy(code: AuthErrorCode): AuthErrorCopy {
  return { code, title: authErrorMessage(code), message: authErrorMessage(code),
    severity: isAuthWarning(code) ? "warning" : "error", ...(errorFields[code] ? { field: errorFields[code] } : {}) };
}
const commonCopies = Object.fromEntries(Object.keys(AUTH_MESSAGES).map((code) => [code, errorCopy(code as AuthErrorCode)]));
export const LOGIN_ERROR_MESSAGES: Readonly<Record<string, AuthErrorCopy>> = {
  ...commonCopies, ...Object.fromEntries(Object.entries(LOGIN_CODES).map(([code, key]) => [code, errorCopy(key)])),
  CredentialsSignin: errorCopy("INVALID_CREDENTIALS"), "unknown-email": errorCopy("INVALID_CREDENTIALS"), "wrong-password": errorCopy("INVALID_CREDENTIALS"),
};
export const REGISTER_ERROR_MESSAGES: Readonly<Record<string, AuthErrorCopy>> = commonCopies;
export function getLoginErrorMessage(code?: string | null): AuthErrorCopy {
  return code && Object.hasOwn(LOGIN_ERROR_MESSAGES, code) ? LOGIN_ERROR_MESSAGES[code] ?? errorCopy("SERVER_ERROR") : errorCopy(code ? "SERVER_ERROR" : "INVALID_CREDENTIALS");
}
export function getRegisterErrorMessage(code?: string | null): AuthErrorCopy {
  return code && isAuthErrorCode(code) ? REGISTER_ERROR_MESSAGES[code] ?? errorCopy("SERVER_ERROR") : errorCopy("SERVER_ERROR");
}

export type ServerLoginValidationResult = { ok: true; data: LoginValues } | { ok: false; code: AuthErrorCode; field?: "email" | "password" };
export function validateLoginServerInput(raw: unknown): ServerLoginValidationResult {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const candidate = { email: record.email, password: record.password, remember: typeof record.remember === "boolean" ? record.remember : true };
  const parsed = loginSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, data: parsed.data };
  if (!sanitizeEmail(record.email) || typeof record.password !== "string" || !record.password) {
    return { ok: false, code: "MISSING_FIELDS", field: !sanitizeEmail(record.email) ? "email" : "password" };
  }
  return { ok: false, code: "INVALID_EMAIL", field: "email" };
}
export type ServerRegisterValidationResult = { ok: true; data: RegisterApiValues } | {
  ok: false; code: AuthErrorCode; field?: "fullName" | "email" | "phone" | "password" | "confirmPassword";
};
export function validateRegistrationServerInput(raw: unknown): ServerRegisterValidationResult {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const parsed = registerApiSchema.safeParse({ ...record, name: record.name ?? record.fullName });
  if (parsed.success) return { ok: true, data: parsed.data };
  const result = authValidationErrors(parsed.error);
  const field = Object.keys(result.fieldErrors)[0];
  const fields: Record<string, NonNullable<AuthErrorCopy["field"]>> = { name: "fullName", email: "email", phone: "phone", password: "password", confirmPassword: "confirmPassword" };
  return { ok: false, code: result.code === "REQUIRED_FIELDS" ? "MISSING_FIELDS" : result.code,
    ...(field && fields[field] ? { field: fields[field] } : {}) };
}
