import { z } from "zod";

/**
 * Shared Zod schemas. The client forms and the checkout store use the same
 * definitions, and `z.infer` keeps the TypeScript types in lockstep.
 */

const requiredString = (field: string, min = 2) =>
  z
    .string()
    .trim()
    .min(min, `${field} must be at least ${min} characters`);

/* -------------------------------------------------------------------------- */
/*  Checkout                                                                  */
/* -------------------------------------------------------------------------- */

export const contactSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .regex(/^[+()\-\s0-9]{7,20}$/, "Enter a valid phone number"),
  marketingOptIn: z.boolean(),
});

export type ContactValues = z.infer<typeof contactSchema>;

export const COUNTRIES = [
  "Bangladesh",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "India",
  "Germany",
  "France",
  "Japan",
  "Singapore",
] as const;

export const shippingSchema = z.object({
  fullName: requiredString("Full name", 3),
  address1: requiredString("Address", 5),
  address2: z.string().trim().optional(),
  city: requiredString("City", 2),
  state: z.string().trim().optional(),
  postalCode: requiredString("Postal code", 3),
  country: z.string().min(1, "Select a country"),
  saveAddress: z.boolean(),
  method: z.enum(["standard", "express"]),
  giftWrap: z.boolean(),
});

export type ShippingValues = z.infer<typeof shippingSchema>;

export const paymentSchema = z
  .object({
    method: z.enum(["card", "mobile", "sslcommerz"]),
    cardNumber: z.string().trim().optional(),
    cardName: z.string().trim().optional(),
    expiry: z.string().trim().optional(),
    cvv: z.string().trim().optional(),
    mobileProvider: z.enum(["bkash", "nagad"]),
    mobileNumber: z.string().trim().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.method !== "card") return;

    const digits = (values.cardNumber ?? "").replace(/\s/g, "");
    if (!/^\d{13,19}$/.test(digits)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cardNumber"],
        message: "Enter a valid card number",
      });
    }

    if (!values.cardName || values.cardName.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cardName"],
        message: "Enter the name on the card",
      });
    }

    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(values.expiry ?? "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiry"],
        message: "Use MM/YY",
      });
    }

    if (!/^\d{3,4}$/.test(values.cvv ?? "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cvv"],
        message: "3 or 4 digits",
      });
    }
  })
  .superRefine((values, ctx) => {
    if (values.method !== "mobile") return;

    const digits = (values.mobileNumber ?? "").replace(/[^\d]/g, "");
    if (digits.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mobileNumber"],
        message: "Enter the mobile number to bill",
      });
    }
  });

export type PaymentValues = z.infer<typeof paymentSchema>;

/** Card numbers Apple-style: 4111 1111 1111 1111. */
export function formatCardNumber(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ")
    .trim();
}

/** Auto-inserts the slash: "1225" → "12/25". */
export function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/* -------------------------------------------------------------------------- */
/*  Auth                                                                      */
/* -------------------------------------------------------------------------- */

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean(),
});

export type LoginValues = z.infer<typeof loginSchema>;

/** Shared, so the strength meter and the schema agree on the rules. */
export const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One number", test: (value: string) => /\d/.test(value) },
  { label: "One special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export function scorePassword(value: string): number {
  return PASSWORD_RULES.filter((rule) => rule.test(value)).length;
}

export const registerSchema = z
  .object({
    fullName: requiredString("Full name", 3),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required")
      .regex(/^[+()\-\s0-9]{7,20}$/, "Enter a valid phone number"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[A-Z]/, "Add an uppercase letter")
      .regex(/\d/, "Add a number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    acceptedTerms: z
      .boolean()
      .refine((value) => value, { message: "Please accept the Terms & Privacy Policy" }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
