/**
 * Regression coverage for the "Something went wrong" (Error ID digest) incident:
 *
 * A production deployment with **no env vars configured** (fresh Vercel project,
 * no DATABASE_URL) must never serve demo products, demo accounts or demo
 * orders. Catalogue reads throw `DatabaseUnavailableError` (the storefront then
 * renders its maintenance state), admin reads throw (the console renders empty
 * tables), and account/order flows keep failing closed.
 */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { DatabaseUnavailableError, requireDatabase } from "../lib/prisma";
import { listProducts, findProduct } from "../lib/data/products";
import { getHeroSettings } from "../lib/data/hero-settings";
import { getCategoryImageMap } from "../lib/data/categories";
import { getAdminOrders } from "../lib/data/admin-orders";
import { getAdminProducts } from "../lib/data/admin-products";
import { getAdminCategories } from "../lib/data/categories";
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

test("unconfigured production catalogue reads reject instead of serving a mock catalogue", async () => {
  unconfiguredProduction();
  await assert.rejects(() => listProducts(), DatabaseUnavailableError);
  await assert.rejects(() => findProduct("anything"), DatabaseUnavailableError);
});

test("unconfigured production hero settings and category covers degrade to defaults", async () => {
  unconfiguredProduction();
  assert.deepEqual(await getHeroSettings(), DEFAULT_HERO_SETTINGS);
  assert.deepEqual(await getCategoryImageMap(), {});
});

test("unconfigured production admin reads reject — the console never invents rows", async () => {
  unconfiguredProduction();
  await assert.rejects(() => getAdminOrders(), DatabaseUnavailableError);
  await assert.rejects(() => getAdminCategories(), DatabaseUnavailableError);
  await assert.rejects(() => getAdminProducts(), DatabaseUnavailableError);
});

test("account and order flows still fail closed on an unconfigured production database", async () => {
  unconfiguredProduction();
  await assert.rejects(() => requireDatabase(async () => true), DatabaseUnavailableError);
});

test("no module path in the app still ships a mock catalogue", async () => {
  // The demo modules are gone for good: nothing may re-import them.
  const { access } = await import("node:fs/promises");
  for (const removed of ["lib/mock-admin.ts", "lib/mock-dashboard.ts", "lib/demo-mode.ts"]) {
    await assert.rejects(() => access(removed), Error, `${removed} must not exist`);
  }
});
