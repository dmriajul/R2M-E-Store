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

export const PAYMENT_METHOD_KEYS = ["COD", "BKASH", "NAGAD", "ROCKET", "SSLCOMMERZ"] as const;

/** Methods that require the customer to transfer money and upload proof. */
export const MANUAL_PAYMENT_KEYS = ["BKASH", "NAGAD", "ROCKET"] as const;

/**
 * Payment step (Step 7).
 *
 * Cash on delivery needs nothing but a tap. The three mobile wallets are
 * *manual*: the customer sends the money to one of the store numbers, keeps the
 * order number as the reference and uploads a screenshot — so the form insists
 * on a screenshot and an explicit "I've completed the payment" tick.
 */
export const paymentSchema = z
  .object({
    method: z.enum(PAYMENT_METHOD_KEYS, {
      errorMap: () => ({ message: "Choose how you'd like to pay" }),
    }),
    /** Wallet the customer is paying from (manual methods). */
    senderNumber: z.string().trim().optional(),
    /** Cloudinary/upload URL of the payment screenshot. */
    screenshotUrl: z.string().trim().optional(),
    /** Transaction id from the wallet app, when the customer has it. */
    transactionId: z.string().trim().optional(),
    /** "I've completed the payment". */
    confirmed: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.method === "COD") return;
    if (!MANUAL_PAYMENT_KEYS.includes(values.method as (typeof MANUAL_PAYMENT_KEYS)[number])) return;

    const digits = (values.senderNumber ?? "").replace(/[^\d]/g, "");
    if (digits.length < 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["senderNumber"],
        message: "Enter the number you're sending from",
      });
    }

    if (!values.screenshotUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["screenshotUrl"],
        message: "Upload the payment screenshot",
      });
    }

    if (!values.confirmed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmed"],
        message: "Tick the box once you've sent the money",
      });
    }
  });

export type PaymentValues = z.infer<typeof paymentSchema>;

/** Registration payload accepted by `POST /api/auth/register`. */
export const registerApiSchema = z.object({
  name: z.string().trim().min(3, "Enter your full name").max(80, "That name is too long"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .regex(/^[+()\-\s0-9]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .regex(/[A-Z]/, "Add an uppercase letter")
    .regex(/\d/, "Add a number"),
});

export type RegisterApiValues = z.infer<typeof registerApiSchema>;

/** `POST /api/orders` payload — prices are re-checked server-side. */
export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        name: z.string().min(1),
        color: z.string().min(1),
        size: z.string().min(1),
        quantity: z.coerce.number().int().min(1).max(10),
        price: z.coerce.number().min(0),
      }),
    )
    .min(1, "Your bag is empty"),
  contact: z.object({
    name: z.string().trim().min(2, "Enter your name"),
    email: z.string().trim().email("Enter a valid email"),
    phone: z.string().trim().min(7, "Enter a phone number"),
  }),
  shipping: z.object({
    address: z.string().trim().min(5, "Enter the delivery address"),
    city: z.string().trim().min(2, "Enter the city"),
    zip: z.string().trim().min(3, "Enter the postal code"),
    country: z.string().trim().min(2, "Enter the country"),
    method: z.enum(["standard", "express"]),
    giftWrap: z.boolean(),
  }),
  payment: z.object({
    method: z.enum(PAYMENT_METHOD_KEYS),
    senderNumber: z.string().trim().optional(),
    screenshotUrl: z.string().trim().optional(),
  }),
  couponCode: z.string().trim().optional(),
});

export type CreateOrderValues = z.infer<typeof createOrderSchema>;

/** Admin decision on a manual payment (`PATCH /api/admin/orders/[n]/payment`). */
export const paymentsAdminSchema = z.object({
  action: z.enum(["approve", "reject", "collect-cash"], {
    errorMap: () => ({ message: "Pick approve, reject or collect-cash" }),
  }),
  note: z.string().trim().max(280, "Keep the note under 280 characters").optional(),
});

export type PaymentsAdminValues = z.infer<typeof paymentsAdminSchema>;

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

/* -------------------------------------------------------------------------- */
/*  Account area (dashboard)                                                  */
/* -------------------------------------------------------------------------- */

/** New/edit address form in the address book. */
export const addressSchema = z.object({
  label: z.string().trim().min(1, "Add a label like Home"),
  fullName: requiredString("Full name", 3),
  line1: requiredString("Address", 5),
  line2: z.string().trim().optional(),
  city: requiredString("City", 2),
  state: z.string().trim().optional(),
  postalCode: requiredString("Postal code", 3),
  country: z.string().min(1, "Select a country"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .regex(/^[+()\-\s0-9]{7,20}$/, "Enter a valid phone number"),
  isDefault: z.boolean(),
});

export type AddressValues = z.infer<typeof addressSchema>;

export const GENDER_OPTIONS = [
  "Female",
  "Male",
  "Non-binary",
  "Prefer not to say",
] as const;

/** Profile details. Email is read-only in the UI but still validated. */
export const profileSchema = z.object({
  fullName: requiredString("Full name", 3),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .regex(/^[+()\-\s0-9]{7,20}$/, "Enter a valid phone number"),
  dateOfBirth: z
    .string()
    .trim()
    .min(1, "Add a date of birth")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date"),
  gender: z.string().trim().min(1, "Pick an option"),
});

export type ProfileValues = z.infer<typeof profileSchema>;

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[A-Z]/, "Add an uppercase letter")
      .regex(/\d/, "Add a number"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ["newPassword"],
    message: "Your new password must be different",
  });

export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;

/** Return request raised from an order (mock — nothing is sent anywhere). */
export const RETURN_REASONS = [
  "Wrong size",
  "Not as described",
  "Changed my mind",
  "Arrived damaged",
  "Other",
] as const;

export const returnRequestSchema = z
  .object({
    reason: z.enum(RETURN_REASONS, {
      errorMap: () => ({ message: "Pick a reason" }),
    }),
    note: z.string().trim().max(300, "Keep it under 300 characters").optional(),
  })
  .refine((values) => values.reason !== "Other" || (values.note ?? "").length >= 10, {
    path: ["note"],
    message: "Tell us a little more (10+ characters)",
  });

export type ReturnRequestValues = z.infer<typeof returnRequestSchema>;

/* -------------------------------------------------------------------------- */
/*  Admin console                                                             */
/* -------------------------------------------------------------------------- */

export const PRODUCT_CATEGORY_NAMES = [
  "Dresses",
  "Tops & Tees",
  "Bottoms",
  "Shoes",
  "Outerwear",
  "Accessories",
] as const;

export const PRODUCT_GENDERS = ["Girls", "Boys", "Unisex"] as const;

/** Age dropdowns run 0 → 14; stored with a trailing "Y" on the product. */
export const AGE_OPTIONS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
] as const;

/** Size grid offered by the product form. */
export const PRODUCT_SIZE_OPTIONS = [
  "2T",
  "3T",
  "4T",
  "5",
  "6",
  "7",
  "8",
  "10",
  "12",
  "14",
] as const;

const optionalNumber = (message: string) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0, message).optional(),
  );

const colourSchema = z.object({
  name: z.string().trim().min(1, "Name the colour"),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex value like #F472B6"),
});

export const adminProductSchema = z
  .object({
    /* Basic info */
    name: requiredString("Product name", 3),
    description: z
      .string()
      .trim()
      .min(10, "Add a description of at least 10 characters")
      .max(600, "Keep the description under 600 characters"),
    category: z.enum(PRODUCT_CATEGORY_NAMES, {
      errorMap: () => ({ message: "Pick a category" }),
    }),
    gender: z.enum(PRODUCT_GENDERS, {
      errorMap: () => ({ message: "Pick who it's for" }),
    }),
    ageMin: z.enum(AGE_OPTIONS),
    ageMax: z.enum(AGE_OPTIONS),

    /* Pricing */
    price: z.coerce.number().positive("Price must be greater than 0"),
    compareAtPrice: optionalNumber("Enter a valid compare-at price"),
    costPerItem: optionalNumber("Enter a valid cost"),

    /* Inventory */
    sku: z
      .string()
      .trim()
      .min(3, "SKU needs at least 3 characters")
      .regex(/^[A-Z0-9-]+$/, "Use capitals, numbers and hyphens"),
    stock: z.coerce.number().int("Whole units only").min(0, "Stock can't be negative"),
    lowStockThreshold: z.coerce
      .number()
      .int("Whole units only")
      .min(0, "Threshold can't be negative"),
    trackInventory: z.boolean(),

    /* Variants */
    colors: z.array(colourSchema).min(1, "Add at least one colour"),
    sizes: z
      .array(z.enum(PRODUCT_SIZE_OPTIONS))
      .min(1, "Pick at least one size"),

    /* Media (mock uploads keep gradient tokens) */
    images: z.array(z.string()),
    modelUrl: z.string().trim().optional(),

    /* SEO */
    metaTitle: z.string().trim().max(70, "Keep the meta title under 70 characters").optional(),
    metaDescription: z
      .string()
      .trim()
      .max(160, "Keep the meta description under 160 characters")
      .optional(),
    slug: z
      .string()
      .trim()
      .min(3, "Slug needs at least 3 characters")
      .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),

    /* Status */
    active: z.boolean(),
    featured: z.boolean(),
    badge: z.enum(["none", "New", "Sale", "Bestseller", "Organic"]),
  })
  .refine((values) => Number(values.ageMax) >= Number(values.ageMin), {
    path: ["ageMax"],
    message: "Max age must be at least the min age",
  })
  .refine(
    (values) =>
      values.compareAtPrice === undefined || values.compareAtPrice > values.price,
    {
      path: ["compareAtPrice"],
      message: "Compare-at price should be higher than the price",
    },
  );

export type AdminProductValues = z.infer<typeof adminProductSchema>;
/** Raw form values — numeric fields arrive as strings before Zod coerces them. */
export type AdminProductFormInput = z.input<typeof adminProductSchema>;

export const COUPON_TYPES = ["percentage", "fixed", "free-shipping"] as const;

export const adminCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Codes need at least 3 characters")
      .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and hyphens only"),
    type: z.enum(COUPON_TYPES, { errorMap: () => ({ message: "Pick a coupon type" }) }),
    value: z.coerce.number().min(0, "Value can't be negative"),
    minOrder: z.coerce.number().min(0, "Minimum order can't be negative"),
    usageLimit: z.coerce.number().int("Whole numbers only").min(0, "Use 0 for unlimited"),
    startsAt: z.string().trim().min(1, "Pick a start date"),
    endsAt: z.string().trim().min(1, "Pick an end date"),
    categories: z.array(z.string()),
    active: z.boolean(),
  })
  .refine(
    (values) => values.type !== "percentage" || (values.value > 0 && values.value <= 100),
    { path: ["value"], message: "A percentage must be between 1 and 100" },
  )
  .refine((values) => values.type !== "fixed" || values.value > 0, {
    path: ["value"],
    message: "Enter the amount to take off",
  })
  .refine((values) => values.endsAt >= values.startsAt, {
    path: ["endsAt"],
    message: "End date must be on or after the start date",
  });

export type AdminCouponValues = z.infer<typeof adminCouponSchema>;
export type AdminCouponFormInput = z.input<typeof adminCouponSchema>;

export const adminCategorySchema = z.object({
  name: requiredString("Category name", 2),
  slug: z
    .string()
    .trim()
    .min(2, "Slug needs at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
  emoji: z.string().trim().min(1, "Pick an emoji").max(4, "One emoji only"),
  description: z.string().trim().max(160, "Keep it under 160 characters").optional(),
  /** Empty string means "top level". */
  parent: z.string(),
});

export type AdminCategoryValues = z.infer<typeof adminCategorySchema>;

const optionalEmail = z
  .string()
  .trim()
  .refine((value) => value === "" || z.string().email().safeParse(value).success, {
    message: "Enter a valid email",
  });

export const settingsGeneralSchema = z.object({
  storeName: requiredString("Store name", 2),
  storeEmail: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .regex(/^[+()\-\s0-9]{7,20}$/, "Enter a valid phone number"),
  address: requiredString("Address", 5),
  currency: z.enum(["USD", "EUR", "GBP"]),
  timezone: z.string().min(1, "Pick a timezone"),
});

export type SettingsGeneralValues = z.infer<typeof settingsGeneralSchema>;

export const settingsShippingSchema = z.object({
  freeShippingThreshold: z.coerce.number().min(0, "Can't be negative"),
  standardRate: z.coerce.number().min(0, "Can't be negative"),
  expressRate: z.coerce.number().min(0, "Can't be negative"),
  giftWrapPrice: z.coerce.number().min(0, "Can't be negative"),
});

export type SettingsShippingValues = z.infer<typeof settingsShippingSchema>;
export type SettingsShippingFormInput = z.input<typeof settingsShippingSchema>;

export const settingsPaymentsSchema = z.object({
  stripeKey: z.string().trim().min(8, "Enter a Stripe key"),
  stripeEnabled: z.boolean(),
  bkashMerchantId: z.string().trim().min(3, "Enter the bKash merchant ID"),
  bkashEnabled: z.boolean(),
  sslcommerzStoreId: z.string().trim().min(3, "Enter the SSLCommerz store ID"),
  sslcommerzEnabled: z.boolean(),
});

export type SettingsPaymentsValues = z.infer<typeof settingsPaymentsSchema>;

export const settingsNotificationsSchema = z.object({
  orderConfirmation: z.boolean(),
  shippingUpdate: z.boolean(),
  lowStockAlert: z.boolean(),
  adminEmail: optionalEmail,
});

export type SettingsNotificationsValues = z.infer<typeof settingsNotificationsSchema>;
