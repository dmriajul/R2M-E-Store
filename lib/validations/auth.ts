import { z } from "zod";
import { AUTH_MESSAGES, type AuthErrorCode, type AuthField } from "@/lib/auth-messages";

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
