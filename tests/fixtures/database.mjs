// EXTERNAL TEST PROCESS ONLY. Never imported by the app or deployed with NODE_OPTIONS.
import { hash } from "bcryptjs";
import { createTestDatabase } from "../support/test-database.ts";
import { PRODUCTS } from "../../lib/site.ts";

const origin = new URL(process.env.AUTH_URL || "http://invalid.example");
if (process.env.TEST_ISOLATED_AUTH !== "true" || process.env.TEST_DATABASE_ADAPTER !== "isolated" ||
    process.env.DATABASE_URL !== "postgresql://isolated.invalid/mukra-test" ||
    process.env.MAILJET_API_KEY || process.env.MAILJET_SECRET_KEY ||
    !["localhost", "127.0.0.1"].includes(origin.hostname)) {
  throw new Error("Database contract fixture refuses non-isolated configuration");
}
const password = await hash("password123", 10);
const product = PRODUCTS.map((entry) => ({ ...entry, active: true, createdAt: new Date(entry.createdAt),
  categories: entry.categories ?? [], costPrice: 0, lowStockThreshold: 5, trackInventory: true, sku: null,
  originalPrice: entry.originalPrice ?? null, material: entry.material ?? null, badge: entry.badge ?? null }));
const fixture = createTestDatabase({
  user: [
    { id: "test-admin", name: "Test Admin", email: "admin@mukra.com", password, role: "SUPER_ADMIN", deletedAt: null, emailVerified: null, createdAt: new Date() },
    { id: "test-customer", name: "Test Shopper", email: "sarah@example.com", password, role: "CUSTOMER", deletedAt: null, emailVerified: null, createdAt: new Date() },
  ],
  product,
  productVariant: PRODUCTS.flatMap((entry) => (entry.variants ?? []).map((variant, index) => ({ ...variant, id: `${entry.id}-${index}`, productId: entry.id }))),
});
Object.assign(globalThis, { prisma: fixture.db });

// Private test-runner IPC rotates a real random token through the shared helper.
// No app route, environment bypass, production token log or automatic verification.
if (process.send) process.on("message", async (message) => {
  if (!message || message.type !== "issue-verification" || typeof message.id !== "string" ||
      typeof message.email !== "string" || !message.email.endsWith("@example.com")) return;
  try {
    const { prepareVerificationResend } = await import("../../lib/email-verification.ts");
    const issued = await prepareVerificationResend(message.email);
    process.send({ type: "verification-issued", id: message.id, token: issued?.token });
  } catch {
    process.send({ type: "verification-issued", id: message.id });
  }
});
