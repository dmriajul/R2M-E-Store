import assert from "node:assert/strict";
import { installTestDatabase } from "./support/test-database";
import { test, afterEach } from "node:test";
import { hash, compare } from "bcryptjs";
import { createUser, findUserByEmail, verifyCredentialsDetailed } from "../lib/data/users";
import {
  DatabaseUnavailableError,
  withRequiredDatabase,
  type PrismaLikeClient,
  type PrismaDelegate,
} from "../lib/prisma";
import { createOrder, listOrdersForEmail } from "../lib/data/orders";
import { authConfig } from "../lib/auth.config";
import { safeCallbackPath } from "../lib/auth-redirect";
import {
  registerSchema,
  registerApiSchema,
  createOrderSchema,
  shippingSchema,
} from "../lib/validations";
import { lookupBangladeshPostcode } from "../lib/bangladesh-locations";
import { computeTotals, getShippingCost, FREE_SHIPPING_THRESHOLD } from "../lib/cart";
import { normalizeRole } from "../lib/rbac";
import type { CreateOrderInput, CartItem, OrderRecord } from "../types";

const scope = globalThis as typeof globalThis & {
  prisma?: PrismaLikeClient;
  prismaUnavailable?: boolean;
};
const oldDatabase = process.env.DATABASE_URL;
afterEach(() => {
  if (oldDatabase === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = oldDatabase;
  delete scope.prisma;
  delete scope.prismaUnavailable;
});

function delegate(overrides: Partial<PrismaDelegate> = {}): PrismaDelegate {
  const unexpected = async (): Promise<never> => {
    throw new Error("Unexpected database operation");
  };
  return {
    findMany: unexpected,
    findUnique: unexpected,
    findFirst: unexpected,
    create: unexpected,
    update: unexpected,
    upsert: unexpected,
    delete: unexpected,
    updateMany: unexpected,
    deleteMany: unexpected,
    count: unexpected,
    ...overrides,
  };
}
function database(overrides: Partial<PrismaLikeClient>): PrismaLikeClient {
  const db: PrismaLikeClient = {
    user: delegate(),
    verificationToken: delegate(),
    roleChange: delegate(),
    product: delegate(),
    order: delegate(),
    orderItem: delegate(),
    returnRequest: delegate(),
    productVariant: delegate(),
    coupon: delegate(),
    category: delegate(),
    review: delegate(),
    wishlistItem: delegate(),
    address: delegate(),
    siteSettings: delegate(),
    $transaction: async (operation) => operation(db),
    ...overrides,
  };
  process.env.DATABASE_URL = "postgresql://test.invalid/test";
  scope.prisma = db;
  return db;
}
const input: CreateOrderInput = {
  items: [
    {
      productId: "test-product",
      name: "Test item",
      color: "Gold",
      size: "4Y",
      quantity: 2,
      price: 600,
    },
  ],
  contact: {
    name: "Test Shopper",
    email: "test@example.com",
    phone: "01700000000",
  },
  shipping: {
    address: "Test road, Shiromoni",
    city: "Khulna",
    state: "Khulna Division",
    zip: "9204",
    country: "Bangladesh",
    method: "express",
    giftWrap: false,
    saveAddress: true,
  },
  payment: { method: "COD" },
};

test("database-contract registration stores a hashed account and accepts its chosen password", async () => {
  installTestDatabase();
  const email = `journey-${crypto.randomUUID()}@example.com`;
  const result = await createUser({
    name: "Test Shopper",
    email,
    password: "ChosenPass123!",
  });
  assert.equal(result.user?.role, "CUSTOMER");
  assert.equal("password" in result.user!, false);
  const stored = await findUserByEmail(email.toUpperCase());
  assert.match(stored!.password, /^\$2[aby]\$10\$/);
  assert.equal(await compare("ChosenPass123!", stored!.password), true);
  assert.equal(
    (await verifyCredentialsDetailed(email, "ChosenPass123!")).user?.id,
    result.user!.id,
  );
  assert.equal(
    (await createUser({ name: "Duplicate", email, password: "OtherPass123!" })).user,
    null,
  );
});

test("unknown email and wrong password return the same safe failure", async () => {
  installTestDatabase();
  await createUser({ name: "Shopper", email: "sarah@example.com", password: "password123" });
  const wrong = await verifyCredentialsDetailed("sarah@example.com", "wrong");
  const unknown = await verifyCredentialsDetailed("absent@example.com", "password123");
  assert.deepEqual(wrong, unknown);
  assert.equal(wrong.failure, "invalid-credentials");
});

test("persisted SUPER_ADMIN remains usable", async () => {
  installTestDatabase();
  await createUser({ name: "Admin", email: "admin@mukra.com", password: "password123", role: "SUPER_ADMIN" });
  assert.equal(
    (await verifyCredentialsDetailed("admin@mukra.com", "password123")).user?.role,
    "SUPER_ADMIN",
  );
  assert.equal(normalizeRole("ADMIN"), "SUPER_ADMIN");
});

test("database credentials compare bcrypt and never return passwords", async () => {
  const password = await hash("DatabasePass123!", 10);
  database({
    user: delegate({
      findFirst: async () => ({
        id: "user-1",
        name: "Customer",
        email: "customer@example.com",
        password,
        role: "CUSTOMER",
        deletedAt: null,
      }),
    }),
  });
  const result = await verifyCredentialsDetailed(" CUSTOMER@example.com ", "DatabasePass123!");
  assert.equal(result.user?.id, "user-1");
  assert.equal("password" in result.user!, false);
  assert.equal(
    (await verifyCredentialsDetailed("customer@example.com", "wrong")).failure,
    "invalid-credentials",
  );
});

test("database plaintext passwords and trashed accounts are refused", async () => {
  const row = {
    id: "u",
    name: "Test",
    email: "test@example.com",
    password: "Plaintext123",
    role: "SUPER_ADMIN",
    deletedAt: null as Date | null,
  };
  database({ user: delegate({ findFirst: async () => row }) });
  assert.equal((await verifyCredentialsDetailed(row.email, row.password)).user, null);
  row.deletedAt = new Date();
  assert.equal(await findUserByEmail(row.email), null);
});

test("configured database outage cannot fall back to demo admin or create a fake account", async () => {
  database({
    user: delegate({
      findFirst: async () => {
        throw new Error("simulated outage");
      },
    }),
  });
  await assert.rejects(
    () => verifyCredentialsDetailed("admin@mukra.com", "password123"),
    /simulated outage/,
  );
  await assert.rejects(
    () =>
      createUser({
        name: "New Customer",
        email: "new@example.com",
        password: "NewPass123!",
      }),
    /simulated outage/,
  );
  scope.prismaUnavailable = true;
  await assert.rejects(
    () =>
      withRequiredDatabase(
        async () => true,
        () => false,
      ),
    DatabaseUnavailableError,
  );
});

test("database registration hashes passwords and sets CUSTOMER by default", async () => {
  let saved: Record<string, unknown> = {};
  database({
    user: delegate({
      findFirst: async () => null,
      create: async (args) => {
        saved = (args as { data: Record<string, unknown> }).data;
        return { id: "new-id", ...saved };
      },
    }),
  });
  const result = await createUser({
    name: "New Customer",
    email: " NEW@EXAMPLE.COM ",
    password: "SecretPass123!",
  });
  assert.equal(result.source, "database");
  assert.equal(saved.email, "new@example.com");
  assert.equal(saved.role, "CUSTOMER");
  assert.equal(await compare("SecretPass123!", saved.password as string), true);
  assert.equal("password" in result.user!, false);
});

test("registration races return a conflict, not fake success", async () => {
  database({
    user: delegate({
      findFirst: async () => null,
      create: async () => {
        throw { code: "P2002" };
      },
    }),
  });
  const result = await createUser({
    name: "New Customer",
    email: "race@example.com",
    password: "Secret123!",
  });
  assert.equal(result.user, null);
  assert.equal(result.error, "EMAIL_ALREADY_EXISTS");
});

test("registration validation checks format, strength, matching and terms", () => {
  assert.equal(
    registerApiSchema.safeParse({
      name: "Test User",
      email: "bad",
      password: "short",
    }).success,
    false,
  );
  const values = {
    fullName: "Test User",
    email: "test@example.com",
    phone: "01700000000",
    password: "Secret123!",
    confirmPassword: "wrong",
    acceptedTerms: true,
  };
  assert.equal(registerSchema.safeParse(values).success, false);
  assert.equal(
    registerSchema.safeParse({ ...values, confirmPassword: values.password }).success,
    true,
  );
  assert.equal(
    registerSchema.safeParse({
      ...values,
      confirmPassword: values.password,
      acceptedTerms: false,
    }).success,
    false,
  );
});

test("callbacks preserve JWT identity, customer role and thirty-day lifetime", async () => {
  const jwtArgs = {
    token: {},
    user: {
      id: "u",
      name: "Customer",
      email: "test@example.com",
      role: "CUSTOMER",
    },
  } as Parameters<typeof authConfig.callbacks.jwt>[0];
  const token = await authConfig.callbacks.jwt(jwtArgs);
  const args = {
    token,
    session: {
      user: { name: "Customer", email: "test@example.com" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
  } as Parameters<typeof authConfig.callbacks.session>[0];
  const session = await authConfig.callbacks.session(args);
  assert.equal(session.user.id, "u");
  assert.equal(session.user.role, "CUSTOMER");
  assert.equal(authConfig.session.strategy, "jwt");
  assert.equal(authConfig.session.maxAge, 2592000);
});

test("middleware redirects guests, denies customers admin, and permits SUPER_ADMIN", async () => {
  const authorize = (path: string, role?: string) =>
    authConfig.callbacks.authorized({
      auth: role ? { user: { id: "u", role } } : null,
      request: { nextUrl: new URL(path, "https://mukra.com") },
    } as Parameters<typeof authConfig.callbacks.authorized>[0]);
  assert.equal(await authorize("/dashboard"), false);
  assert.equal(await authorize("/dashboard", "CUSTOMER"), true);
  const denied = await authorize("/admin", "CUSTOMER");
  assert.ok(denied instanceof Response);
  assert.equal(denied.headers.get("location"), "https://mukra.com/dashboard");
  assert.equal(await authorize("/admin/staff", "SUPER_ADMIN"), true);
  assert.equal(await authorize("/admin", "ADMIN"), true);
});

test("callback redirects accept same-origin paths and reject external/script URLs", () => {
  const origin = "https://preview.e2b.app";
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "javascript:alert(1)",
    "/login",
    null,
  ])
    assert.equal(safeCallbackPath(value, origin), "/dashboard");
  assert.equal(safeCallbackPath(`${origin}/checkout?step=2`, origin), "/checkout?step=2");
  assert.equal(safeCallbackPath("/admin/orders", origin), "/admin/orders");
});

test("9204 identifies Shiromoni and shipping validation enforces Bangladesh location", () => {
  assert.deepEqual(lookupBangladeshPostcode("9204"), {
    division: "Khulna Division",
    district: "Khulna",
    postalArea: "Shiromoni",
  });
  const address = {
    fullName: "Test User",
    address1: "Road 1, Shiromoni",
    city: "Khulna",
    state: "Khulna Division",
    postalCode: "9204",
    country: "Bangladesh",
    saveAddress: true,
    method: "express",
    giftWrap: false,
  };
  assert.equal(shippingSchema.safeParse(address).success, true);
  assert.equal(shippingSchema.safeParse({ ...address, city: "Dhaka" }).success, false);
  assert.equal(shippingSchema.safeParse({ ...address, postalCode: "92" }).success, false);
});

test("order API schema rejects invalid phones, quantities and incomplete wallet payments", () => {
  assert.equal(createOrderSchema.safeParse(input).success, true);
  assert.equal(
    createOrderSchema.safeParse({
      ...input,
      contact: { ...input.contact, phone: "1234567" },
    }).success,
    false,
  );
  assert.equal(
    createOrderSchema.safeParse({
      ...input,
      items: [{ ...input.items[0], quantity: 0 }],
    }).success,
    false,
  );
  assert.equal(
    createOrderSchema.safeParse({ ...input, payment: { method: "BKASH" } }).success,
    false,
  );
});

test("BDT totals use 80/150 delivery and the configured free threshold", () => {
  assert.equal(getShippingCost("standard", 1200), 80);
  assert.equal(getShippingCost("express", 1200), 150);
  assert.equal(getShippingCost("express", FREE_SHIPPING_THRESHOLD), 0);
  const result = computeTotals([{ price: 600, quantity: 2 } as CartItem], {
    method: "express",
  });
  assert.equal(result.total, 1350);
});

test("order transaction aggregates variant stock and saves opt-in address with owned order", async () => {
  const updates: unknown[] = [];
  let savedOrder: Record<string, unknown> = {};
  let savedAddress: Record<string, unknown> = {};
  database({
    product: delegate({
      findUnique: async () => ({
        id: "test-product",
        name: "Test item",
        variants: [{ id: "variant-1", color: "Gold", size: "4Y", stock: 10 }],
      }),
    }),
    productVariant: delegate({
      updateMany: async (args) => {
        updates.push(args);
        return { count: 1 };
      },
    }),
    address: delegate({
      findFirst: async () => null,
      create: async (args) => {
        savedAddress = (args as { data: Record<string, unknown> }).data;
        return { id: "address" };
      },
    }),
    order: delegate({
      create: async (args) => {
        savedOrder = (args as { data: Record<string, unknown> }).data;
        return { id: "order" };
      },
    }),
  });
  const result = await createOrder(
    { ...input, items: [input.items[0]!, input.items[0]!] },
    { id: "customer", name: "Test", email: "test@example.com" },
  );
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0], {
    where: { id: "variant-1", stock: { gte: 4 } },
    data: { stock: { decrement: 4 } },
  });
  assert.equal(savedOrder.userId, "customer");
  assert.equal(savedAddress.zip, "9204");
  assert.equal(result.source, "database");
});

test("stock conflict aborts transaction without inserting order or returning a fake success", async () => {
  let inserted = false;
  database({
    product: delegate({
      findUnique: async () => ({
        id: "test-product",
        name: "Test item",
        variants: [],
      }),
      updateMany: async () => ({ count: 0 }),
    }),
    order: delegate({
      create: async () => {
        inserted = true;
        return { id: "bad" };
      },
    }),
  });
  await assert.rejects(
    () =>
      createOrder(input, {
        id: "customer",
        name: "Test",
        email: "test@example.com",
      }),
    /Not enough stock/,
  );
  assert.equal(inserted, false);
});

test("order reads use account ownership, not the recipient email", async () => {
  let query: unknown;
  database({
    order: delegate({
      findMany: async (args) => {
        query = args;
        return [];
      },
    }),
  });
  await listOrdersForEmail("recipient@example.com", "customer-id");
  assert.deepEqual((query as { where: unknown }).where, {
    userId: "customer-id",
  });
});

test("cart quantity, stock, removal and localStorage rehydration", async () => {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  const { useCartStore } = await import("../store/useCartStore");
  const { PRODUCTS } = await import("../lib/site");
  const product = {
    ...PRODUCTS[0]!,
    id: "cart-test",
    price: 600,
    colors: ["Gold"],
    sizes: ["4Y"],
    stock: 5,
    variants: [{ color: "Gold", size: "4Y", stock: 3 }],
  };
  const cart = () => useCartStore.getState();
  cart().clearCart();
  cart().addItem(product, 2, { color: "Gold", size: "4Y" });
  assert.equal(cart().itemCount, 2);
  assert.equal(cart().total, 1200);
  const id = cart().items[0]!.lineId;
  cart().updateQuantity(id, 99);
  assert.equal(cart().itemCount, 3);
  const persisted = [...values.values()].find((value) => value.includes("cart-test"));
  assert.ok(persisted);
  useCartStore.setState({ items: [], total: 0, itemCount: 0 });
  // Restore the saved browser state then exercise Zustand's real rehydration.
  for (const key of values.keys()) if (key.includes("cart")) values.set(key, persisted);
  await useCartStore.persist.rehydrate();
  assert.equal(cart().itemCount, 3);
  cart().removeItem(id);
  assert.equal(cart().items.length, 0);
  cart().addItem({
    ...product,
    variants: [{ color: "Gold", size: "4Y", stock: 0 }],
  });
  assert.equal(cart().items.length, 0);
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

test("customer status and five-step tracking reflect database state", async () => {
  const { toDashboardOrder } = await import("../lib/dashboard-orders");
  const record: OrderRecord = {
    id: "order-test",
    orderNumber: "LL-2026-TEST",
    status: "PENDING",
    paymentStatus: "UNPAID",
    paymentMethod: "COD",
    subtotal: 1200,
    shipping: 150,
    discount: 0,
    giftWrap: 0,
    total: 1350,
    items: input.items,
    customerName: "Test User",
    email: "test@example.com",
    phone: "01700000000",
    address: "Test Road",
    city: "Khulna",
    zip: "9204",
    country: "Bangladesh",
    createdAt: new Date().toISOString(),
    source: "database",
  };
  assert.equal(toDashboardOrder(record).status, "pending");
  const processing = toDashboardOrder({ ...record, status: "PROCESSING" });
  assert.equal(processing.timeline.length, 5);
  assert.equal(processing.timeline.find((step) => step.key === "processing")?.state, "current");
  const delivered = toDashboardOrder({ ...record, status: "DELIVERED", paymentStatus: "PAID" });
  assert.ok(delivered.timeline.every((step) => step.state === "done"));
  assert.equal(
    toDashboardOrder({ ...record, status: "REFUNDED", paymentStatus: "REFUNDED" }).status,
    "refunded",
  );
});
