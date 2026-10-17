/**
 * Catalogue state handling — the regression net for the "We'll be right back"
 * incident.
 *
 * The storefront must distinguish three situations, because they need three
 * different surfaces:
 *
 *   1. rows exist              → products render normally;
 *   2. database answered, 0 rows → premium empty state ("being curated");
 *   3. database not configured → "opening soon" (setup state, not an outage);
 *   4. database configured but failing → maintenance notice.
 *
 * `getCatalogue` is the page-facing helper that resolves (1)–(3) and (4) into a
 * status instead of throwing, so /shop, /collections and the home page can keep
 * their layout instead of falling into the error boundary.
 */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installTestDatabase } from "./support/test-database";
import {
  getCatalogue,
  isCatalogueOutage,
  type CatalogueStatus,
} from "../lib/data/products";
import { listProducts } from "../lib/data/products";
import { DatabaseUnavailableError, type PrismaLikeClient } from "../lib/prisma";

const scope = globalThis as typeof globalThis & {
  prisma?: PrismaLikeClient;
  prismaUnavailable?: boolean;
};
const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  delete scope.prisma;
  delete scope.prismaUnavailable;
});

/** Minimal active product row, shaped like the Prisma `Product` model. */
function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod_1",
    name: "Merino Cardigan",
    slug: "merino-cardigan",
    description: "Buttery merino knit, finished by hand.",
    price: 3490,
    originalPrice: null,
    category: "Sweaters & Cardigans",
    categories: ["Sweaters & Cardigans"],
    gender: "Girls",
    ageRange: "3-5Y",
    material: "100% merino wool",
    colors: ["Cream"],
    sizes: ["4Y"],
    images: ["/images/products/merino-cardigan.jpg"],
    stock: 7,
    badge: "New",
    featured: true,
    featuredOrder: 1,
    active: true,
    createdAt: new Date("2026-10-01T09:00:00.000Z"),
    ...overrides,
  };
}

test("a stocked catalogue is reported as ready and maps rows into storefront products", async () => {
  installTestDatabase({ product: [productRow()] });

  const snapshot = await getCatalogue();

  assert.equal(snapshot.status, "ready");
  assert.equal(snapshot.products.length, 1);
  const [product] = snapshot.products;
  assert.equal(product?.name, "Merino Cardigan");
  assert.equal(product?.category, "Sweaters & Cardigans");
  assert.equal(product?.inStock, true);
  assert.equal(product?.status, "active");
});

test("an empty but reachable catalogue is reported as empty — never as an outage", async () => {
  installTestDatabase({ product: [] });

  const snapshot = await getCatalogue();

  assert.equal(snapshot.status, "empty");
  assert.deepEqual(snapshot.products, []);
  assert.equal(isCatalogueOutage(snapshot.status), false);
});

test("inactive (draft) rows are excluded, so a draft-only catalogue reads as empty", async () => {
  installTestDatabase({ product: [productRow({ active: false })] });

  const snapshot = await getCatalogue();

  assert.equal(snapshot.status, "empty");
  assert.deepEqual(snapshot.products, []);
});

test("an unconfigured database is a setup state, not an outage", async () => {
  delete process.env.DATABASE_URL;
  delete scope.prisma;
  delete scope.prismaUnavailable;

  const snapshot = await getCatalogue();
  const status: CatalogueStatus = snapshot.status;

  assert.equal(status, "unconfigured");
  assert.equal(isCatalogueOutage(status), false);
  assert.deepEqual(snapshot.products, []);
});

test("a configured database that fails is reported as unavailable (the only outage state)", async () => {
  // A real connection failure surfaces from Prisma as code P1001; the data
  // layer converts it to DatabaseUnavailableError, and getCatalogue resolves
  // that into the maintenance status instead of throwing into the route.
  installTestDatabase({
    product: [],
  });
  const failing: PrismaLikeClient = {
    ...(scope.prisma as PrismaLikeClient),
    product: {
      findMany: async () => {
        throw Object.assign(new Error("connect ECONNREFUSED"), { code: "P1001" });
      },
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      upsert: async () => ({}),
      delete: async () => ({}),
      updateMany: async () => ({ count: 0 }),
      deleteMany: async () => ({ count: 0 }),
      count: async () => 0,
    },
  };
  scope.prisma = failing;
  process.env.DATABASE_URL = "postgresql://isolated.invalid/mukra-test";

  const snapshot = await getCatalogue();

  assert.equal(snapshot.status, "unavailable");
  assert.equal(isCatalogueOutage(snapshot.status), true);
  assert.deepEqual(snapshot.products, []);
});

test("the low-level listing still throws for an unreachable catalogue (API contract)", async () => {
  delete process.env.DATABASE_URL;
  delete scope.prisma;
  delete scope.prismaUnavailable;

  await assert.rejects(() => listProducts(), DatabaseUnavailableError);
});
