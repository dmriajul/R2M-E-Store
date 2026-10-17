/**
 * Regression: NULL array/text columns from Postgres must never crash the
 * catalogue mappers.
 *
 * `prisma/schema.prisma` declares `Product.categories` / `colors` / `sizes` /
 * `images` as non-null `String[]`, but the deployed DDL
 * (`supabase/tests/schema.sql`) created them as plain nullable `TEXT[]`. A row
 * written outside Prisma can therefore hold NULL while the *generated* client
 * type still promises `string[]` — so the compiler cannot warn, and the first
 * dereference (`row.images.some(…)`) threw inside the Server Component render.
 *
 * Blast radius before the fix, reproduced against a production build:
 *   • `images` NULL      → `/`, `/shop`, `/product/[id]`, `/sitemap.xml` (500),
 *                          `/api/products` (500) — the whole storefront.
 *   • `colors`/`sizes`   → `/product/[id]` (`colors.join` in the JSON-LD).
 *   • `categories`       → `/admin/products` only.
 *
 * The console mapper (`toAdminProduct` in lib/data/admin-products.ts) is
 * hardened the same way, but that module imports `server-only` transitively via
 * lib/data/media.ts, so it cannot be loaded outside Next's bundler; it is
 * covered by the route-level reproduction instead of this unit test.
 */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installTestDatabase } from "./support/test-database";
import {
  findProduct,
  listProducts,
  rowToProduct,
  toNumber,
  toStringArray,
  toText,
  type ProductRow,
} from "../lib/data/products";

const scope = globalThis as typeof globalThis & {
  prisma?: unknown;
  prismaUnavailable?: boolean;
};
const oldDatabase = process.env.DATABASE_URL;

afterEach(() => {
  if (oldDatabase === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = oldDatabase;
  delete scope.prisma;
  delete scope.prismaUnavailable;
});

/** A catalogue row exactly as a drifted Postgres table can return it. */
function driftRow(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: "drift-1",
    name: "Drifted Product",
    slug: "drifted-product",
    description: null,
    price: null,
    originalPrice: null,
    category: null,
    categories: null,
    gender: null,
    ageRange: null,
    material: null,
    colors: null,
    sizes: null,
    images: null,
    stock: null,
    badge: null,
    featured: false,
    featuredOrder: 0,
    virtualBoutique: false,
    newArrival: false,
    bestSeller: false,
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as ProductRow;
}

/* -------------------------------------------------------------------------- */
/*  Normalizers                                                               */
/* -------------------------------------------------------------------------- */

test("toStringArray tolerates null, undefined and non-string entries", () => {
  assert.deepEqual(toStringArray(null), []);
  assert.deepEqual(toStringArray(undefined), []);
  assert.deepEqual(toStringArray("not-an-array"), []);
  assert.deepEqual(toStringArray(["a", null, 3, "b"]), ["a", "b"]);
  assert.deepEqual(toStringArray(["a"]), ["a"]);
});

test("toText and toNumber fall back instead of throwing", () => {
  assert.equal(toText(null), "");
  assert.equal(toText(null, "0-12Y"), "0-12Y");
  assert.equal(toText("kept"), "kept");
  assert.equal(toNumber(null), 0);
  assert.equal(toNumber(Number.NaN, 5), 5);
  assert.equal(toNumber(12), 12);
});

/* -------------------------------------------------------------------------- */
/*  Storefront mapper                                                         */
/* -------------------------------------------------------------------------- */

test("rowToProduct survives a row where every nullable column is NULL", () => {
  const product = rowToProduct(driftRow());

  assert.deepEqual(product.images, []);
  assert.deepEqual(product.colors, []);
  assert.deepEqual(product.sizes, []);
  assert.equal(product.description, "");
  assert.equal(product.tagline, "");
  assert.equal(product.price, 0);
  assert.equal(product.stock, 0);
  assert.equal(product.inStock, false);
  /* Unknown/NULL category resolves to the taxonomy's catch-all, so the
     `CATEGORY_META[category]` lookups downstream stay defined. */
  assert.equal(product.category, "Accessories");
  assert.deepEqual(product.categories, ["Accessories"]);
  assert.equal(product.ageRange, "0-12Y");
  assert.equal(product.gender, "Girls");
  assert.equal(product.material, "Organic cotton");
});

test("rowToProduct keeps real values and drops only the NULLs", () => {
  const product = rowToProduct(
    driftRow({
      description: "A real description",
      price: 1250,
      colors: ["Pink", "Mint"],
      sizes: ["2Y", "4Y"],
      images: ["/uploads/a.jpg"],
      categories: ["Tops & Tees"],
    }),
  );

  assert.equal(product.description, "A real description");
  assert.equal(product.price, 1250);
  assert.deepEqual(product.colors, ["Pink", "Mint"]);
  assert.deepEqual(product.sizes, ["2Y", "4Y"]);
  assert.deepEqual(product.images, ["/uploads/a.jpg"]);
  assert.deepEqual(product.categories, ["Tops & Tees"]);
});

test("rowToProduct tolerates a NULL variants relation", () => {
  const product = rowToProduct(driftRow({ variants: null, stock: 7 }));

  assert.equal(product.variants, undefined);
  assert.equal(product.stock, 7);
});

/* -------------------------------------------------------------------------- */
/*  Through the data layer                                                    */
/* -------------------------------------------------------------------------- */

test("listProducts reads a drifted row from the database instead of throwing", async () => {
  installTestDatabase({ product: [driftRow() as unknown as Record<string, unknown>] });

  const { products, source } = await listProducts();

  /* `source` must be "database": a silent mock fallback would hide the bug the
     same way the old code hid the admin console's. */
  assert.equal(source, "database");
  const drifted = products.find((product) => product.id === "drift-1");
  assert.ok(drifted, "the drifted row should still be listed");
  assert.ok(Array.isArray(drifted.images));
  assert.ok(Array.isArray(drifted.colors));
  assert.ok(Array.isArray(drifted.sizes));
});

test("findProduct resolves a drifted row by slug", async () => {
  installTestDatabase({ product: [driftRow() as unknown as Record<string, unknown>] });

  const { product, source } = await findProduct("drifted-product");

  assert.equal(source, "database");
  assert.ok(product);
  assert.equal(product.id, "drift-1");
  assert.ok(Array.isArray(product.colors));
});

test("a drifted row does not break the rest of the catalogue", async () => {
  installTestDatabase({
    product: [
      driftRow() as unknown as Record<string, unknown>,
      {
        id: "healthy-1",
        name: "Healthy Product",
        slug: "healthy-product",
        description: "Fine row",
        price: 900,
        originalPrice: null,
        category: "Tops & Tees",
        categories: ["Tops & Tees"],
        gender: "Girls",
        ageRange: "3-5Y",
        material: "Organic cotton",
        colors: ["Pink"],
        sizes: ["4Y"],
        images: ["/uploads/healthy.jpg"],
        stock: 3,
        badge: null,
        featured: false,
        featuredOrder: 0,
        virtualBoutique: false,
        newArrival: false,
        bestSeller: false,
        active: true,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      } as unknown as Record<string, unknown>,
    ],
  });

  const { products } = await listProducts();

  assert.equal(products.length, 2);
  const healthy = products.find((product) => product.id === "healthy-1");
  assert.ok(healthy);
  assert.equal(healthy.price, 900);
  assert.deepEqual(healthy.colors, ["Pink"]);
  assert.equal(healthy.inStock, true);
});
