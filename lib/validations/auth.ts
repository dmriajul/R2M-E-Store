import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Input Sanitization                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Sanitizes general user text input:
 * - Normalizes Unicode to NFC
 * - Strips ASCII control characters and null bytes
 * - Strips HTML angle brackets to prevent tag injection
 * - Trims leading/trailing whitespace
 */
export function sanitizeInput(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .trim();
}

/**
 * Sanitizes and normalizes an email address (lowercase, trimmed, control chars stripped).
 */
export function sanitizeEmail(value: unknown): string {
  return sanitizeInput(value).toLowerCase();
}

/**
 * Sanitizes a phone number string while keeping valid phone characters.
 */
export function sanitizePhone(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .trim();
}

/* -------------------------------------------------------------------------- */
/*  Regex & Constants                                                         */
/* -------------------------------------------------------------------------- */

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const PHONE_REGEX = /^[+()\-\s0-9]{7,20}$/;
export const PASSWORD_MIN_LENGTH = 8;

/* -------------------------------------------------------------------------- */
/*  Error Codes & User-Friendly Error Mapping                                 */
/* -------------------------------------------------------------------------- */

export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  RATE_LIMITED: "RATE_LIMITED",
  EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
  INVALID_EMAIL: "INVALID_EMAIL",
  WEAK_PASSWORD: "WEAK_PASSWORD",
  PASSWORD_MISMATCH: "PASSWORD_MISMATCH",
  MISSING_FIELDS: "MISSING_FIELDS",
  INVALID_PHONE: "INVALID_PHONE",
  SERVER_ERROR: "SERVER_ERROR",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export interface AuthErrorCopy {
  code: AuthErrorCode;
  title: string;
  message: string;
  severity: "error" | "warning";
  field?: "fullName" | "email" | "phone" | "password" | "confirmPassword";
}

/**
 * Maps server-returned login error codes to user-friendly messages.
 *
 * Security rule: Wrong email AND wrong password map to the exact same
 * generic message ("Invalid email or password. Please try again.") so account
 * existence is never revealed.
 */
export const LOGIN_ERROR_MESSAGES: Readonly<Record<string, AuthErrorCopy>> = {
  INVALID_CREDENTIALS: {
    code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    title: "Invalid email or password",
    message: "Invalid email or password. Please try again.",
    severity: "error",
  },
  CredentialsSignin: {
    code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    title: "Invalid email or password",
    message: "Invalid email or password. Please try again.",
    severity: "error",
  },
  "unknown-email": {
    code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    title: "Invalid email or password",
    message: "Invalid email or password. Please try again.",
    severity: "error",
  },
  "wrong-password": {
    code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    title: "Invalid email or password",
    message: "Invalid email or password. Please try again.",
    severity: "error",
  },
  EMAIL_NOT_VERIFIED: {
    code: AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED,
    title: "Please verify your email first",
    message: "Please verify your email address before logging in. Check your inbox.",
    severity: "warning",
    field: "email",
  },
  ACCOUNT_LOCKED: {
    code: AUTH_ERROR_CODES.ACCOUNT_LOCKED,
    title: "Account temporarily locked",
    message: "Too many failed attempts. Please try again later or reset your password.",
    severity: "error",
  },
  RATE_LIMITED: {
    code: AUTH_ERROR_CODES.RATE_LIMITED,
    title: "Account temporarily locked",
    message: "Too many failed attempts. Please try again later or reset your password.",
    severity: "error",
  },
  MISSING_FIELDS: {
    code: AUTH_ERROR_CODES.MISSING_FIELDS,
    title: "Missing required fields",
    message: "Please fill in all required fields.",
    severity: "error",
  },
  INVALID_EMAIL: {
    code: AUTH_ERROR_CODES.INVALID_EMAIL,
    title: "Please enter a valid email",
    message: "Please enter a valid email address.",
    severity: "error",
    field: "email",
  },
  SERVER_ERROR: {
    code: AUTH_ERROR_CODES.SERVER_ERROR,
    title: "Sign-in failed",
    message: "Something went wrong. Please try again later.",
    severity: "error",
  },
};

/**
 * Maps server-returned registration error codes to user-friendly messages.
 */
export const REGISTER_ERROR_MESSAGES: Readonly<Record<string, AuthErrorCopy>> = {
  EMAIL_ALREADY_EXISTS: {
    code: AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS,
    title: "Email already registered",
    message: "An account with this email already exists. Please login or use a different email.",
    severity: "error",
    field: "email",
  },
  INVALID_EMAIL: {
    code: AUTH_ERROR_CODES.INVALID_EMAIL,
    title: "Please enter a valid email",
    message: "Please enter a valid email address.",
    severity: "error",
    field: "email",
  },
  WEAK_PASSWORD: {
    code: AUTH_ERROR_CODES.WEAK_PASSWORD,
    title: "Weak password",
    message: "Password must be at least 8 characters with uppercase, lowercase, and number.",
    severity: "error",
    field: "password",
  },
  PASSWORD_MISMATCH: {
    code: AUTH_ERROR_CODES.PASSWORD_MISMATCH,
    title: "Passwords do not match",
    message: "Passwords do not match. Please try again.",
    severity: "error",
    field: "confirmPassword",
  },
  MISSING_FIELDS: {
    code: AUTH_ERROR_CODES.MISSING_FIELDS,
    title: "Missing required fields",
    message: "Please fill in all required fields.",
    severity: "error",
  },
  INVALID_PHONE: {
    code: AUTH_ERROR_CODES.INVALID_PHONE,
    title: "Invalid phone number",
    message: "Please enter a valid phone number.",
    severity: "error",
    field: "phone",
  },
  RATE_LIMITED: {
    code: AUTH_ERROR_CODES.RATE_LIMITED,
    title: "Too many attempts",
    message: "Too many failed attempts. Please try again later or reset your password.",
    severity: "error",
  },
  SERVER_ERROR: {
    code: AUTH_ERROR_CODES.SERVER_ERROR,
    title: "Registration failed",
    message: "Something went wrong. Please try again later.",
    severity: "error",
  },
};

const DEFAULT_LOGIN_ERROR: AuthErrorCopy = {
  code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
  title: "Invalid email or password",
  message: "Invalid email or password. Please try again.",
  severity: "error",
};

const DEFAULT_LOGIN_SERVER_ERROR: AuthErrorCopy = {
  code: AUTH_ERROR_CODES.SERVER_ERROR,
  title: "Sign-in failed",
  message: "Something went wrong. Please try again later.",
  severity: "error",
};

const DEFAULT_REGISTER_ERROR: AuthErrorCopy = {
  code: AUTH_ERROR_CODES.SERVER_ERROR,
  title: "Registration failed",
  message: "Something went wrong. Please try again later.",
  severity: "error",
};

export function getLoginErrorMessage(code?: string | null): AuthErrorCopy {
  if (!code) return DEFAULT_LOGIN_ERROR;
  return LOGIN_ERROR_MESSAGES[code] ?? DEFAULT_LOGIN_SERVER_ERROR;
}

export function getRegisterErrorMessage(code?: string | null): AuthErrorCopy {
  if (!code) return DEFAULT_REGISTER_ERROR;
  return REGISTER_ERROR_MESSAGES[code] ?? DEFAULT_REGISTER_ERROR;
}

/* -------------------------------------------------------------------------- */
/*  Reusable Validation Functions                                             */
/* -------------------------------------------------------------------------- */

/**
 * Checks whether an email address matches standard email format.
 */
export function isValidEmail(email: string): boolean {
  const cleaned = sanitizeEmail(email);
  if (!cleaned || cleaned.length > 254) return false;
  return EMAIL_REGEX.test(cleaned);
}

/**
 * Validates an email address and returns a structured result with error code and message.
 */
export function validateEmail(email: string): {
  valid: boolean;
  sanitized: string;
  code?: AuthErrorCode;
  error?: string;
} {
  const sanitized = sanitizeEmail(email);
  if (!sanitized) {
    return {
      valid: false,
      sanitized: "",
      code: AUTH_ERROR_CODES.MISSING_FIELDS,
      error: "Email is required",
    };
  }
  if (!EMAIL_REGEX.test(sanitized) || sanitized.length > 254) {
    return {
      valid: false,
      sanitized,
      code: AUTH_ERROR_CODES.INVALID_EMAIL,
      error: "Please enter a valid email address.",
    };
  }
  return { valid: true, sanitized };
}

/**
 * Password rules shared between the PasswordStrength component and validation schemas.
 */
export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (value: string) => value.length >= PASSWORD_MIN_LENGTH },
  { id: "uppercase", label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { id: "lowercase", label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { id: "number", label: "One number", test: (value: string) => /\d/.test(value) },
  { id: "special", label: "One special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export interface PasswordStrengthResult {
  valid: boolean;
  /** 0 to 4 score for the 4-bar strength meter. */
  score: number;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  code?: AuthErrorCode;
  error?: string;
}

/**
 * Evaluates password strength against required rules.
 * Required for registration: min 8 chars, uppercase, lowercase, and number.
 * Special character boosts the strength score to the maximum level (4/4).
 */
export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const hasMinLength = password.length >= PASSWORD_MIN_LENGTH;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  const valid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  let rawPoints = 0;
  if (hasMinLength) rawPoints += 1;
  if (hasUppercase && hasLowercase) rawPoints += 1;
  else if (hasUppercase || hasLowercase) rawPoints += 0.5;
  if (hasNumber) rawPoints += 1;
  if (hasSpecialChar) rawPoints += 1;

  const score = password.length === 0 ? 0 : Math.min(4, Math.max(1, Math.floor(rawPoints)));

  if (!password) {
    return {
      valid: false,
      score: 0,
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar,
      code: AUTH_ERROR_CODES.MISSING_FIELDS,
      error: "Password is required",
    };
  }

  if (!valid) {
    return {
      valid: false,
      score,
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar,
      code: AUTH_ERROR_CODES.WEAK_PASSWORD,
      error: "Password must be at least 8 characters with uppercase, lowercase, and number.",
    };
  }

  return {
    valid: true,
    score: hasSpecialChar ? 4 : Math.max(3, score),
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
  };
}

/**
 * Returns a 0–4 strength score used by `<PasswordStrength />`.
 */
export function scorePassword(value: string): number {
  return checkPasswordStrength(value).score;
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  const maxLen = Math.max(bufA.length, bufB.length, 1);
  let diff = bufA.length ^ bufB.length;
  for (let i = 0; i < maxLen; i += 1) {
    const byteA = bufA.length > 0 ? (bufA[i % bufA.length] ?? 0) : 0;
    const byteB = bufB.length > 0 ? (bufB[i % bufB.length] ?? 0) : 0;
    diff |= byteA ^ byteB;
  }
  return diff === 0;
}

/* -------------------------------------------------------------------------- */
/*  Zod Schemas (Client & Shared)                                             */
/* -------------------------------------------------------------------------- */

const emailFieldSchema = z
  .string()
  .transform((value) => sanitizeEmail(value))
  .superRefine((value, ctx) => {
    if (!value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email is required",
      });
      return;
    }
    if (!EMAIL_REGEX.test(value) || value.length > 254) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter a valid email address.",
      });
    }
  });

export const loginSchema = z.object({
  email: emailFieldSchema,
  password: z.string().superRefine((value, ctx) => {
    if (!value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password is required",
      });
      return;
    }
    if (value.length < PASSWORD_MIN_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      });
    }
  }),
  remember: z.boolean(),
});

export type LoginValues = z.infer<typeof loginSchema>;

const strongPasswordFieldSchema = z.string().superRefine((value, ctx) => {
  if (!value) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Password is required",
    });
    return;
  }
  const check = checkPasswordStrength(value);
  if (!check.valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Password must be at least 8 characters with uppercase, lowercase, and number.",
    });
  }
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .transform((value) => sanitizeInput(value))
      .superRefine((value, ctx) => {
        if (!value) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Full name is required",
          });
          return;
        }
        if (value.length < 3) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Full name must be at least 3 characters",
          });
          return;
        }
        if (value.length > 80) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Full name must be under 80 characters",
          });
        }
      }),
    email: emailFieldSchema,
    phone: z
      .string()
      .transform((value) => sanitizePhone(value))
      .superRefine((value, ctx) => {
        if (!value) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Phone number is required",
          });
          return;
        }
        if (!PHONE_REGEX.test(value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please enter a valid phone number.",
          });
        }
      }),
    password: strongPasswordFieldSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    acceptedTerms: z
      .boolean()
      .refine((value) => value, { message: "Please accept the Terms & Privacy Policy" }),
  })
  .refine((values) => !values.confirmPassword || values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match. Please try again.",
  });

export type RegisterValues = z.infer<typeof registerSchema>;

/** Registration payload accepted by `POST /api/auth/register`. */
export const registerApiSchema = z.object({
  name: z
    .string()
    .transform((value) => sanitizeInput(value))
    .pipe(z.string().min(2, "Full name is required").max(80, "Full name is too long")),
  email: emailFieldSchema,
  phone: z
    .string()
    .transform((value) => sanitizePhone(value))
    .refine((value) => value === "" || PHONE_REGEX.test(value), "Please enter a valid phone number.")
    .optional()
    .or(z.literal("")),
  password: strongPasswordFieldSchema,
  confirmPassword: z.string().optional(),
});

export type RegisterApiValues = z.infer<typeof registerApiSchema>;

export const forgotPasswordSchema = z.object({
  email: emailFieldSchema,
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/* -------------------------------------------------------------------------- */
/*  Server-Side Validation Helpers (Returns Error Codes)                      */
/* -------------------------------------------------------------------------- */

export type ServerLoginValidationResult =
  | {
      ok: true;
      data: {
        email: string;
        password: string;
        remember: boolean;
      };
    }
  | {
      ok: false;
      code: AuthErrorCode;
      field?: "email" | "password";
    };

/**
 * Sanitizes and validates raw login payload on the server, returning specific error codes.
 */
export function validateLoginServerInput(raw: unknown): ServerLoginValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, code: AUTH_ERROR_CODES.MISSING_FIELDS };
  }

  const record = raw as Record<string, unknown>;
  const email = sanitizeEmail(record.email);
  const password = typeof record.password === "string" ? record.password : "";
  const remember = typeof record.remember === "boolean" ? record.remember : true;

  if (!email || !password) {
    return {
      ok: false,
      code: AUTH_ERROR_CODES.MISSING_FIELDS,
      field: !email ? "email" : "password",
    };
  }

  if (!isValidEmail(email)) {
    return {
      ok: false,
      code: AUTH_ERROR_CODES.INVALID_EMAIL,
      field: "email",
    };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    };
  }

  return {
    ok: true,
    data: { email, password, remember },
  };
}

export type ServerRegisterValidationResult =
  | {
      ok: true;
      data: {
        name: string;
        email: string;
        phone?: string;
        password: string;
      };
    }
  | {
      ok: false;
      code: AuthErrorCode;
      field?: "fullName" | "email" | "phone" | "password" | "confirmPassword";
    };

/**
 * Sanitizes and validates raw registration payload on the server, returning specific error codes.
 */
export function validateRegistrationServerInput(raw: unknown): ServerRegisterValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, code: AUTH_ERROR_CODES.MISSING_FIELDS };
  }

  const record = raw as Record<string, unknown>;
  const name = sanitizeInput(record.name ?? record.fullName);
  const email = sanitizeEmail(record.email);
  const phone = sanitizePhone(record.phone);
  const password = typeof record.password === "string" ? record.password : "";
  const confirmPassword =
    typeof record.confirmPassword === "string" ? record.confirmPassword : undefined;

  if (!name || !email || !password || name.length < 2) {
    return {
      ok: false,
      code: AUTH_ERROR_CODES.MISSING_FIELDS,
      field: !name || name.length < 2 ? "fullName" : !email ? "email" : "password",
    };
  }

  if (!isValidEmail(email)) {
    return {
      ok: false,
      code: AUTH_ERROR_CODES.INVALID_EMAIL,
      field: "email",
    };
  }

  if (phone && !PHONE_REGEX.test(phone)) {
    return {
      ok: false,
      code: AUTH_ERROR_CODES.INVALID_PHONE,
      field: "phone",
    };
  }

  const strength = checkPasswordStrength(password);
  if (!strength.valid) {
    return {
      ok: false,
      code: AUTH_ERROR_CODES.WEAK_PASSWORD,
      field: "password",
    };
  }

  if (confirmPassword !== undefined && confirmPassword !== password) {
    return {
      ok: false,
      code: AUTH_ERROR_CODES.PASSWORD_MISMATCH,
      field: "confirmPassword",
    };
  }

  return {
    ok: true,
    data: {
      name,
      email,
      phone: phone || undefined,
      password,
    },
  };
}
