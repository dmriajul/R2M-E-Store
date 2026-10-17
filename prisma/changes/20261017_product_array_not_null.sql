-- Repair for an EXISTING MUKRA database whose catalogue columns drifted from
-- `prisma/schema.prisma`. Apply with the deployment's reviewed SQL workflow.
-- This is not a fresh-database baseline; this repo has no Prisma migration
-- history. Do NOT blindly `db push` or seed production.
--
-- WHY THIS EXISTS
--   The Prisma schema declares these as non-null scalar lists:
--       Product.categories  String[] @default([])
--       Product.colors      String[]
--       Product.sizes       String[]
--       Product.images      String[]
--       ReturnRequest.images String[]
--   The deployed DDL (mirrored by supabase/tests/schema.sql) created them as
--   plain nullable TEXT[] with no NOT NULL. Any row written outside Prisma — a
--   SQL import, a backfill, a restore — can therefore store NULL, while the
--   *generated* client type still promises `string[]`. TypeScript cannot warn
--   about it, so the first dereference threw during the Server Component render
--   and the storefront fell through to the "Something went wrong" boundary:
--       TypeError: Cannot read properties of null (reading 'some')   -- images
--       TypeError: Cannot read properties of null (reading 'join')   -- colors/sizes
--       TypeError: Cannot read properties of null (reading 'length') -- categories
--   The application now normalizes these on read (lib/data/products.ts,
--   lib/data/admin-products.ts), so it no longer crashes. This file closes the
--   other half of the gap: it makes the database match the schema Prisma types
--   against, so NULLs cannot be written again.
--
-- ORDER OF OPERATIONS
--   1. Back up / confirm the target database.
--   2. Run the READ-ONLY AUDIT below first and review the counts.
--   3. Deploy the application fix (it tolerates NULL either way).
--   4. Apply this file. It is transactional and idempotent for the backfill;
--      the SET NOT NULL statements are no-ops once applied.

/* -------------------------------------------------------------------------- */
/*  1. READ-ONLY AUDIT — run this first, change nothing                       */
/* -------------------------------------------------------------------------- */

-- Which columns are actually nullable in this database? Anything listed here
-- with is_nullable = 'YES' has drifted from prisma/schema.prisma.
SELECT table_name, column_name, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = current_schema()
   AND ((table_name = 'Product'
         AND column_name IN ('categories', 'colors', 'sizes', 'images'))
     OR (table_name = 'ReturnRequest' AND column_name = 'images'))
 ORDER BY table_name, column_name;

-- How many rows would be rewritten by the backfill?
SELECT
  (SELECT count(*) FROM "Product"       WHERE "categories" IS NULL) AS product_categories_null,
  (SELECT count(*) FROM "Product"       WHERE "colors"     IS NULL) AS product_colors_null,
  (SELECT count(*) FROM "Product"       WHERE "sizes"      IS NULL) AS product_sizes_null,
  (SELECT count(*) FROM "Product"       WHERE "images"     IS NULL) AS product_images_null,
  (SELECT count(*) FROM "ReturnRequest" WHERE "images"     IS NULL) AS return_images_null;

/* -------------------------------------------------------------------------- */
/*  2. BACKFILL + CONSTRAINTS                                                 */
/* -------------------------------------------------------------------------- */

BEGIN;

-- Empty array, never NULL: that is the value Prisma's generated types assume.
UPDATE "Product"       SET "categories" = ARRAY[]::TEXT[] WHERE "categories" IS NULL;
UPDATE "Product"       SET "colors"     = ARRAY[]::TEXT[] WHERE "colors"     IS NULL;
UPDATE "Product"       SET "sizes"      = ARRAY[]::TEXT[] WHERE "sizes"      IS NULL;
UPDATE "Product"       SET "images"     = ARRAY[]::TEXT[] WHERE "images"     IS NULL;
UPDATE "ReturnRequest" SET "images"     = ARRAY[]::TEXT[] WHERE "images"     IS NULL;

-- `categories` is the only one the schema gives an explicit @default([]);
-- the rest are required lists, which Prisma also creates with an empty-array
-- default so an INSERT that omits them cannot produce NULL.
ALTER TABLE "Product"       ALTER COLUMN "categories" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product"       ALTER COLUMN "colors"     SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product"       ALTER COLUMN "sizes"      SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product"       ALTER COLUMN "images"     SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ReturnRequest" ALTER COLUMN "images"     SET DEFAULT ARRAY[]::TEXT[];

-- These fail if any NULL survived, which is the point: the transaction rolls
-- back and nothing is left half-applied.
ALTER TABLE "Product"       ALTER COLUMN "categories" SET NOT NULL;
ALTER TABLE "Product"       ALTER COLUMN "colors"     SET NOT NULL;
ALTER TABLE "Product"       ALTER COLUMN "sizes"      SET NOT NULL;
ALTER TABLE "Product"       ALTER COLUMN "images"     SET NOT NULL;
ALTER TABLE "ReturnRequest" ALTER COLUMN "images"     SET NOT NULL;

COMMIT;

/* -------------------------------------------------------------------------- */
/*  3. VERIFY                                                                 */
/* -------------------------------------------------------------------------- */

-- Expect five rows, every is_nullable = 'NO'.
SELECT table_name, column_name, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = current_schema()
   AND ((table_name = 'Product'
         AND column_name IN ('categories', 'colors', 'sizes', 'images'))
     OR (table_name = 'ReturnRequest' AND column_name = 'images'))
 ORDER BY table_name, column_name;

-- Expect 0 for every column.
SELECT
  (SELECT count(*) FROM "Product"       WHERE "categories" IS NULL) AS product_categories_null,
  (SELECT count(*) FROM "Product"       WHERE "colors"     IS NULL) AS product_colors_null,
  (SELECT count(*) FROM "Product"       WHERE "sizes"      IS NULL) AS product_sizes_null,
  (SELECT count(*) FROM "Product"       WHERE "images"     IS NULL) AS product_images_null,
  (SELECT count(*) FROM "ReturnRequest" WHERE "images"     IS NULL) AS return_images_null;

-- No RLS change is made here: this file only tightens column constraints on
-- tables that already have their policies from supabase/migrations/. Do NOT
-- disable existing RLS.
