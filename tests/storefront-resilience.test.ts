/**
 * Regression coverage for the "Something went wrong" (Error ID digest) incident:
 *
 * A production deployment with **no env vars configured** (fresh Vercel project,
 * no DATABASE_URL) must still render the storefront. Catalogue reads resolve to
 * the documented mock fallback, admin reads honour their `null`-when-
 * unconfigured contract, and account/order flows keep failing closed.
 */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { DatabaseUnavailableError, withRequiredDatabase, requireDatabase } from "../lib/prisma";
import { listProducts, findProduct } from "../lib/data/products";
import { getHeroSettings } from "../lib/data/hero-settings";
import { getAdminCategories, getCategoryImageMap } from "../lib/data/categories";
import { getAdminOrders } from "../lib/data/admin-orders";
import { getAdminProducts } from "../lib/data/admin-products";
import { DEFAULT_HERO_SETTINGS } from "../lib/hero-settings";

const env = { ...process.env };
const scope = globalThis as typeof globalThis & { prisma?: unknown; prismaUnavailable?: boolean };

afterEach(() => {
  process.env = { ...env };
  delete scope.prisma;
  delete scope.prismaUnavailable;
});

function unconfiguredProduction() {
  process.env = { ...env, NODE_ENV: "production" };
  delete process.env.DATABASE_URL;
  delete process.env.ALLOW_DEMO_MODE;
  delete scope.prisma;
  delete scope.prismaUnavailable;
}

test("unconfigured production storefront reads resolve to the mock catalogue instead of throwing", async () => {
  unconfiguredProduction();
  const { products, source } = await listProducts();
  assert.equal(source, "mock");
  assert.ok(products.length > 0, "demo catalogue should still render");

  const found = await findProduct("floral-summer-dress");
  assert.equal(found.source, "mock");
  assert.equal(found.product?.id, "floral-summer-dress");

  const missing = await findProduct("does-not-exist");
  assert.equal(missing.product, null, "unknown products 404 instead of crashing");
});

test("unconfigured production hero settings and category covers degrade to defaults", async () => {
  unconfiguredProduction();
  assert.deepEqual(await getHeroSettings(), DEFAULT_HERO_SETTINGS);
  assert.deepEqual(await getCategoryImageMap(), {});
});

test("unconfigured production admin reads resolve to null so the console keeps its in-session dataset", async () => {
  unconfiguredProduction();
  assert.equal(await getAdminOrders(), null);
  assert.equal(await getAdminCategories(), null);
  assert.equal(await getAdminProducts(), null);
});

test("account and order flows still fail closed on an unconfigured production database", async () => {
  unconfiguredProduction();
  await assert.rejects(() => withRequiredDatabase(async () => true, () => false), DatabaseUnavailableError);
  await assert.rejects(() => requireDatabase(async () => true), DatabaseUnavailableError);
});
