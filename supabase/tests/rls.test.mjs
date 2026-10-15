#!/usr/bin/env node
/* eslint-disable no-console -- a test runner reports results on stdout */
/**
 * RLS policy tests for supabase/migrations/001–005.
 *
 * Runs the REAL migration files against a throwaway in-memory Postgres
 * (PGlite — Postgres compiled to WASM, no server needed) seeded with the
 * shape of prisma/schema.prisma (schema.sql in this folder), then asserts the
 * policy matrix from supabase/README.md — including the critical guarantee
 * that the table OWNER (the role Prisma connects as) still sees everything,
 * i.e. the NextAuth storefront and admin panel are unaffected.
 *
 * Usage:
 *   npm i --no-save @electric-sql/pglite      # one-off; not a project dep
 *   node supabase/tests/rls.test.mjs
 *
 * Exit code 0 = all assertions passed.
 */

import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "migrations");
const MIGRATIONS = [
  "001_enable_rls.sql",
  "002_rls_helper_functions.sql",
  "003_rls_policies_accounts.sql",
  "004_rls_policies_orders.sql",
  "005_rls_policies_catalog.sql",
];

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function checkEqual(name, actual, expected) {
  check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function main() {
  const db = new PGlite();

  // ---------------------------------------------------------------------
  // 1. Schema + migrations (as the owner — the way `prisma db push` +
  //    SQL Editor would apply them).
  // ---------------------------------------------------------------------
  await db.exec(await readFile(path.join(here, "schema.sql"), "utf8"));
  for (const file of MIGRATIONS) {
    await db.exec(await readFile(path.join(migrationsDir, file), "utf8"));
  }

  console.log("\nMigrations apply cleanly");
  {
    const r = await db.query(
      `SELECT count(*)::int AS n FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity`,
    );
    checkEqual("RLS is enabled on all 12 public tables", r.rows[0].n, 12);

    const p = await db.query(
      `SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public'`,
    );
    check("policies were created (40 expected)", p.rows[0].n === 40, `got ${p.rows[0].n}`);
  }

  // Idempotency: re-running every migration must be a no-op, not an error.
  {
    let ok = true;
    try {
      for (const file of MIGRATIONS) {
        await db.exec(await readFile(path.join(migrationsDir, file), "utf8"));
      }
    } catch {
      ok = false;
      console.log(error);
    }
    check("re-running 001–005 is idempotent", ok);
  }

  // ---------------------------------------------------------------------
  // 2. Seed — two shoppers, five staff personas, orders, catalog, …
  // ---------------------------------------------------------------------
  await db.exec(`
    INSERT INTO "User" ("id","name","email","password","role","updatedAt") VALUES
      ('cust1','Customer One','c1@example.com','hash1','CUSTOMER', now()),
      ('cust2','Customer Two','c2@example.com','hash2','CUSTOMER', now()),
      ('support','Support Manager','support@mukra.com','hash3','SUPPORT_MANAGER', now()),
      ('super','Super Admin','admin@mukra.com','hash4','SUPER_ADMIN', now()),
      ('legacy','Legacy Admin','legacy@mukra.com','hash5','ADMIN', now()),
      ('seo','SEO Manager','seo@mukra.com','hash6','SEO_MANAGER', now()),
      ('inv','Inventory Manager','inventory@mukra.com','hash7','INVENTORY_MANAGER', now());

    INSERT INTO "Product" ("id","name","slug","description","price","category","gender","ageRange","colors","sizes","images","updatedAt") VALUES
      ('prod1','Party Dress','party-dress','Lovely',1200,'Dresses','Girls','3-4Y',ARRAY['Red'],ARRAY['3-4Y'],ARRAY[]::TEXT[], now()),
      ('prod2','Denim Jacket','denim-jacket','Smart',1800,'Outerwear','Boys','5-6Y',ARRAY['Blue'],ARRAY['5-6Y'],ARRAY[]::TEXT[], now());

    INSERT INTO "ProductVariant" ("id","productId","size","color","stock") VALUES
      ('var1','prod1','3-4Y','Red',5),
      ('var2','prod2','5-6Y','Blue',3);

    INSERT INTO "Order" ("id","orderNumber","userId","subtotal","total","paymentMethod","shippingName","shippingEmail","shippingPhone","shippingAddress","shippingCity","shippingZip","updatedAt") VALUES
      ('ord1','LL-2025-00001','cust1',1200,1250,'COD','C1','c1@example.com','01711111111','House 1','Khulna','9000', now()),
      ('ord2','LL-2025-00002','cust2',1800,1850,'COD','C2','c2@example.com','01722222222','House 2','Dhaka','1200', now());

    INSERT INTO "OrderItem" ("id","orderId","productId","name","color","size","quantity","price") VALUES
      ('item1','ord1','prod1','Party Dress','Red','3-4Y',1,1200),
      ('item2','ord2','prod2','Denim Jacket','Blue','5-6Y',1,1800);

    INSERT INTO "Address" ("id","userId","name","phone","address1","city","zip") VALUES
      ('addr1','cust1','C1','01711111111','House 1','Khulna','9000'),
      ('addr2','cust2','C2','01722222222','House 2','Dhaka','1200');

    INSERT INTO "WishlistItem" ("id","userId","productId") VALUES
      ('wish1','cust1','prod2'),
      ('wish2','cust2','prod1');

    INSERT INTO "Review" ("id","userId","productId","rating","comment") VALUES
      ('rev0','cust2','prod2',5,'Great jacket');

    INSERT INTO "Coupon" ("id","code","type","value","active") VALUES
      ('cpn1','WELCOME10','PERCENTAGE',10,true),
      ('cpn2','SECRET50','PERCENTAGE',50,false);

    INSERT INTO "Category" ("id","name","slug","updatedAt") VALUES
      ('cat1','Dresses','dresses', now());

    INSERT INTO "SiteSettings" ("id","heroTitle") VALUES
      ('global','Tiny trends, big smiles');

    INSERT INTO "ReturnRequest" ("id","orderId","userId","orderItemId","type","reason","updatedAt") VALUES
      ('ret1','ord1','cust1','item1','EXCHANGE','Too small', now());
  `);

  // ---------------------------------------------------------------------
  // 3. Persona helpers — simulate PostgREST callers (role + JWT claims).
  // ---------------------------------------------------------------------
  async function asApi(role, userId, fn) {
    await db.exec(`SET ROLE ${role}`);
    await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [
      userId ? JSON.stringify({ sub: userId, role }) : "",
    ]);
    try {
      return await fn();
    } finally {
      await db.query(`SELECT set_config('request.jwt.claims', '', false)`);
      await db.exec(`RESET ROLE`);
    }
  }

  const selectCount = (role, userId, table) =>
    asApi(role, userId, async () => {
      const r = await db.query(`SELECT count(*)::int AS n FROM ${table}`);
      return r.rows[0].n;
    });

  const run = (role, userId, sql) => asApi(role, userId, () => db.query(sql));

  async function throws(role, userId, sql, label) {
    try {
      await run(role, userId, sql);
      check(label, false, "expected an error (RLS deny), query succeeded");
    } catch {
      check(label, true);
    }
  }

  /** Denial at either layer counts: privilege error, or 0 rows via RLS. */
  async function denied(role, userId, sql, label) {
    try {
      const r = await run(role, userId, sql);
      const n = r.rows ? r.rows.length : 0;
      check(label, n === 0, `expected a denial, query affected ${n} row(s)`);
    } catch {
      check(label, true);
    }
  }

  // ---------------------------------------------------------------------
  // 4. The owner role (what Prisma connects as) — the app must be untouched.
  // ---------------------------------------------------------------------
  console.log("\nOwner / Prisma path (bypasses RLS — app keeps working)");
  {
    await db.query(`SELECT set_config('request.jwt.claims', '', false)`);
    const orders = await db.query(`SELECT count(*)::int AS n FROM "Order"`);
    checkEqual("owner sees ALL orders (checkout/admin unaffected)", orders.rows[0].n, 2);
    const users = await db.query(`SELECT count(*)::int AS n FROM "User"`);
    checkEqual("owner sees ALL users (staff console unaffected)", users.rows[0].n, 7);
    const upd = await db.query(`UPDATE "Order" SET status = 'CONFIRMED' WHERE id = 'ord1' RETURNING id`);
    checkEqual("owner can update order status (admin panel flow)", upd.rows.length, 1);
    const ins = await db.query(`INSERT INTO "Coupon" ("id","code","type","value") VALUES ('cpn3','OWNER','FIXED',5) RETURNING id`);
    checkEqual("owner can insert coupons (admin panel flow)", ins.rows.length, 1);
    const del = await db.query(`DELETE FROM "Coupon" WHERE id = 'cpn3' RETURNING id`);
    checkEqual("owner can delete coupons (admin panel flow)", del.rows.length, 1);
  }

  // ---------------------------------------------------------------------
  // 5. Anonymous PostgREST caller (the anon key — the attack path).
  // ---------------------------------------------------------------------
  console.log("\nAnonymous API caller (anon key, no JWT)");
  checkEqual("anon sees 0 orders", await selectCount("anon", null, `"Order"`), 0);
  checkEqual("anon sees 0 order items", await selectCount("anon", null, `"OrderItem"`), 0);
  checkEqual("anon sees 0 users", await selectCount("anon", null, `"User"`), 0);
  checkEqual("anon sees 0 addresses", await selectCount("anon", null, `"Address"`), 0);
  checkEqual("anon sees 0 wishlist items", await selectCount("anon", null, `"WishlistItem"`), 0);
  checkEqual("anon sees 0 return requests", await selectCount("anon", null, `"ReturnRequest"`), 0);
  checkEqual("anon sees the product catalogue", await selectCount("anon", null, `"Product"`), 2);
  checkEqual("anon sees product variants", await selectCount("anon", null, `"ProductVariant"`), 2);
  checkEqual("anon sees reviews", await selectCount("anon", null, `"Review"`), 1);
  checkEqual("anon sees ACTIVE coupons only", await selectCount("anon", null, `"Coupon"`), 1);
  checkEqual("anon sees categories", await selectCount("anon", null, `"Category"`), 1);
  checkEqual("anon sees site settings", await selectCount("anon", null, `"SiteSettings"`), 1);

  await throws(
    "anon", null,
    `INSERT INTO "Review" ("id","userId","productId","rating","comment") VALUES ('revX','cust1','prod1',5,'spam')`,
    "anon cannot post reviews",
  );
  await throws(
    "anon", null,
    `INSERT INTO "Order" ("id","orderNumber","userId","subtotal","total","paymentMethod","shippingName","shippingEmail","shippingPhone","shippingAddress","shippingCity","shippingZip","updatedAt") VALUES ('ordX','LL-X','cust1',1,1,'COD','a','a','a','a','a','a', now())`,
    "anon cannot create orders",
  );
  {
    const r = await run("anon", null, `UPDATE "Coupon" SET active = true WHERE id = 'cpn2' RETURNING id`);
    checkEqual("anon cannot update coupons", r.rows.length, 0);
    const u = await run("anon", null, `UPDATE "User" SET name = 'x' RETURNING id`);
    checkEqual("anon cannot update users", u.rows.length, 0);
    await denied("anon", null, `DELETE FROM "User" RETURNING id`, "anon cannot delete users");
    const o = await run("anon", null, `UPDATE "Order" SET status = 'CANCELLED' RETURNING id`);
    checkEqual("anon cannot update orders", o.rows.length, 0);
    const v = await run("anon", null, `UPDATE "ProductVariant" SET stock = 0 RETURNING id`);
    checkEqual("anon cannot update product variants", v.rows.length, 0);
    const rr = await run("anon", null, `UPDATE "ReturnRequest" SET status = 'APPROVED' RETURNING id`);
    checkEqual("anon cannot update return requests", rr.rows.length, 0);
    const w = await run("anon", null, `DELETE FROM "WishlistItem" RETURNING id`);
    checkEqual("anon cannot delete wishlist items", w.rows.length, 0);
    const rv = await run("anon", null, `DELETE FROM "Review" RETURNING id`);
    checkEqual("anon cannot delete reviews", rv.rows.length, 0);
  }
  await throws("anon", null, `SELECT password FROM "User"`, "anon cannot read password hashes (column grant)");

  // ---------------------------------------------------------------------
  // 6. Customer One — signed in via the API (JWT sub = cust1).
  // ---------------------------------------------------------------------
  console.log("\nCustomer One (authenticated, sub=cust1)");
  checkEqual("sees own order only", await selectCount("authenticated", "cust1", `"Order"`), 1);
  checkEqual("sees own order items only", await selectCount("authenticated", "cust1", `"OrderItem"`), 1);
  checkEqual("sees own address only", await selectCount("authenticated", "cust1", `"Address"`), 1);
  checkEqual("sees own wishlist only", await selectCount("authenticated", "cust1", `"WishlistItem"`), 1);
  checkEqual("sees own profile only", await selectCount("authenticated", "cust1", `"User"`), 1);
  checkEqual("sees own return request only", await selectCount("authenticated", "cust1", `"ReturnRequest"`), 1);
  checkEqual("sees active coupons only", await selectCount("authenticated", "cust1", `"Coupon"`), 1);
  {
    const r = await run("authenticated", "cust1", `SELECT id FROM "Order"`);
    checkEqual("own order is the one returned", r.rows[0]?.id, "ord1");
  }
  {
    const r = await run("authenticated", "cust1", `UPDATE "Order" SET status = 'CANCELLED' WHERE id = 'ord1' RETURNING id`);
    checkEqual("customer cannot update own order status", r.rows.length, 0);
  }
  {
    const r = await run("authenticated", "cust1", `UPDATE "User" SET role = 'SUPER_ADMIN' WHERE id = 'cust1' RETURNING id`);
    checkEqual("customer cannot escalate own role", r.rows.length, 0);
  }
  {
    const r = await run(
      "authenticated", "cust1",
      `INSERT INTO "Review" ("id","userId","productId","rating","comment") VALUES ('rev1','cust1','prod1',5,'Loved it') RETURNING id`,
    );
    checkEqual("buyer can review a purchased product", r.rows.length, 1);
  }
  await throws(
    "authenticated", "cust1",
    `INSERT INTO "Review" ("id","userId","productId","rating","comment") VALUES ('rev2','cust1','prod2',5,'Never bought this')`,
    "buyer cannot review an unpurchased product",
  );
  await throws(
    "authenticated", "cust1",
    `INSERT INTO "Review" ("id","userId","productId","rating","comment") VALUES ('rev3','cust2','prod1',5,'impersonation')`,
    "buyer cannot post a review as someone else",
  );
  {
    const r = await run("authenticated", "cust1", `UPDATE "Review" SET comment = 'Fixed typo' WHERE id = 'rev1' RETURNING id`);
    checkEqual("author can edit own review", r.rows.length, 1);
    const d = await run("authenticated", "cust1", `DELETE FROM "Review" WHERE id = 'rev1' RETURNING id`);
    checkEqual("even the author cannot delete reviews (staff only)", d.rows.length, 0);
    const d2 = await run("authenticated", "cust1", `DELETE FROM "Review" WHERE id = 'rev0' RETURNING id`);
    checkEqual("customer cannot delete others' reviews", d2.rows.length, 0);
  }
  {
    const ins = await run(
      "authenticated", "cust1",
      `INSERT INTO "Address" ("id","userId","name","phone","address1","city","zip") VALUES ('addr3','cust1','Me','017','x','Khulna','9000') RETURNING id`,
    );
    checkEqual("customer can add own address", ins.rows.length, 1);
  }
  await throws(
    "authenticated", "cust1",
    `INSERT INTO "Address" ("id","userId","name","phone","address1","city","zip") VALUES ('addrX','cust2','Evil','017','x','x','x')`,
    "customer cannot add an address for someone else",
  );
  {
    const r = await run("authenticated", "cust1", `UPDATE "Address" SET city = 'Sylhet' WHERE id = 'addr1' RETURNING id`);
    checkEqual("customer can edit own address", r.rows.length, 1);
    const r2 = await run("authenticated", "cust1", `UPDATE "Address" SET city = 'Sylhet' WHERE id = 'addr2' RETURNING id`);
    checkEqual("customer cannot edit someone else's address", r2.rows.length, 0);
    const d = await run("authenticated", "cust1", `DELETE FROM "Address" WHERE id = 'addr2' RETURNING id`);
    checkEqual("customer cannot delete someone else's address", d.rows.length, 0);
    const d2 = await run("authenticated", "cust1", `DELETE FROM "Address" WHERE id = 'addr3' RETURNING id`);
    checkEqual("customer can delete own address", d2.rows.length, 1);
  }
  {
    const ins = await run(
      "authenticated", "cust1",
      `INSERT INTO "ReturnRequest" ("id","orderId","userId","orderItemId","type","reason","updatedAt") VALUES ('ret2','ord1','cust1','item1','REFUND','Changed mind', now()) RETURNING id`,
    );
    checkEqual("customer can open a return on own order item", ins.rows.length, 1);
  }
  await throws(
    "authenticated", "cust1",
    `INSERT INTO "ReturnRequest" ("id","orderId","userId","orderItemId","type","reason","updatedAt") VALUES ('retX','ord2','cust1','item2','REFUND','not mine', now())`,
    "customer cannot open a return on someone else's item",
  );
  await throws(
    "authenticated", "cust1",
    `INSERT INTO "ReturnRequest" ("id","orderId","userId","orderItemId","type","reason","updatedAt") VALUES ('retY','ord1','cust2','item1','REFUND','spoofed', now())`,
    "customer cannot open a return as another user",
  );
  {
    const r = await run("authenticated", "cust1", `UPDATE "ReturnRequest" SET status = 'APPROVED' WHERE id = 'ret1' RETURNING id`);
    checkEqual("customer cannot approve own return request", r.rows.length, 0);
    const w = await run(
      "authenticated", "cust1",
      `INSERT INTO "WishlistItem" ("id","userId","productId") VALUES ('wish3','cust1','prod1') RETURNING id`,
    );
    checkEqual("customer can add own wishlist item", w.rows.length, 1);
  }
  {
    const r = await run("authenticated", "cust1", `SELECT public.app_is_staff() AS s`);
    check("helper: customer is not staff", r.rows[0].s === false || r.rows[0].s === "f" || r.rows[0].s === 0);
  }

  // ---------------------------------------------------------------------
  // 7. Customer Two — cross-account isolation.
  // ---------------------------------------------------------------------
  console.log("\nCustomer Two (authenticated, sub=cust2)");
  checkEqual("sees own order only (not cust1's)", await selectCount("authenticated", "cust2", `"Order"`), 1);
  checkEqual("sees own wishlist only", await selectCount("authenticated", "cust2", `"WishlistItem"`), 1);
  await throws(
    "authenticated", "cust2",
    `INSERT INTO "Review" ("id","userId","productId","rating","comment") VALUES ('revZ','cust2','prod1',5,'unbought')`,
    "customer cannot review a product they never bought",
  );
  {
    const r = await run("authenticated", "cust2", `UPDATE "Order" SET notes = 'x' WHERE id = 'ord1' RETURNING id`);
    checkEqual("customer cannot touch someone else's order", r.rows.length, 0);
    const u = await run("authenticated", "cust2", `SELECT name FROM "User" WHERE id = 'cust1'`);
    checkEqual("customer cannot read someone else's profile", u.rows.length, 0);
    const a = await run("authenticated", "cust2", `SELECT id FROM "Address" WHERE id = 'addr1'`);
    checkEqual("customer cannot read someone else's address", a.rows.length, 0);
    const t = await run("authenticated", "cust2", `SELECT id FROM "OrderItem" WHERE id = 'item1'`);
    checkEqual("customer cannot read someone else's order items", t.rows.length, 0);
  }

  // ---------------------------------------------------------------------
  // 8. Support manager — orders, returns, shipping addresses, reviews.
  // ---------------------------------------------------------------------
  console.log("\nSupport manager (authenticated, sub=support)");
  checkEqual("sees ALL orders", await selectCount("authenticated", "support", `"Order"`), 2);
  checkEqual("sees ALL order items", await selectCount("authenticated", "support", `"OrderItem"`), 2);
  checkEqual("sees ALL addresses (shipping support)", await selectCount("authenticated", "support", `"Address"`), 2);
  checkEqual("sees ALL return requests", await selectCount("authenticated", "support", `"ReturnRequest"`), 2);
  checkEqual("sees only own user profile (not all users)", await selectCount("authenticated", "support", `"User"`), 1);
  checkEqual("sees active coupons only (not super admin)", await selectCount("authenticated", "support", `"Coupon"`), 1);
  {
    const r = await run("authenticated", "support", `UPDATE "Order" SET status = 'CONFIRMED' WHERE id = 'ord2' RETURNING id`);
    checkEqual("staff can update order status", r.rows.length, 1);
    const t = await run("authenticated", "support", `UPDATE "ReturnRequest" SET status = 'APPROVED', "adminNote" = 'ok' RETURNING id`);
    checkEqual("support can update ALL return requests", t.rows.length, 2);
    const d = await run("authenticated", "support", `DELETE FROM "Review" WHERE id = 'rev0' RETURNING id`);
    checkEqual("staff can delete reviews", d.rows.length, 1);
  }
  await throws(
    "authenticated", "support",
    `INSERT INTO "Coupon" ("id","code","type","value") VALUES ('cpnS','STAFF','FIXED',5)`,
    "support cannot create coupons (super admin only)",
  );

  // ---------------------------------------------------------------------
  // 9. Super admin & legacy ADMIN.
  // ---------------------------------------------------------------------
  console.log("\nSuper admin (sub=super) and legacy ADMIN (sub=legacy)");
  checkEqual("super admin sees ALL users", await selectCount("authenticated", "super", `"User"`), 7);
  checkEqual("super admin sees ALL coupons (incl. inactive)", await selectCount("authenticated", "super", `"Coupon"`), 2);
  checkEqual("legacy ADMIN sees ALL users (normalises to SUPER_ADMIN)", await selectCount("authenticated", "legacy", `"User"`), 7);
  {
    const r = await run("authenticated", "super", `UPDATE "User" SET role = 'SUPPORT_MANAGER' WHERE id = 'cust2' RETURNING id`);
    checkEqual("super admin can update any user", r.rows.length, 1);
    const u = await run("authenticated", "super", `UPDATE "User" SET role = 'CUSTOMER' WHERE id = 'cust2' RETURNING id`);
    checkEqual("super admin update is reversible", u.rows.length, 1);
    const ins = await run("authenticated", "super", `INSERT INTO "Coupon" ("id","code","type","value","active") VALUES ('cpnA','ADMIN10','PERCENTAGE',10,false) RETURNING id`);
    checkEqual("super admin can create coupons", ins.rows.length, 1);
    const upd = await run("authenticated", "super", `UPDATE "Coupon" SET value = 20 WHERE id = 'cpnA' RETURNING id`);
    checkEqual("super admin can update coupons", upd.rows.length, 1);
    const del = await run("authenticated", "super", `DELETE FROM "Coupon" WHERE id = 'cpnA' RETURNING id`);
    checkEqual("super admin can delete coupons", del.rows.length, 1);
  }
  await throws("authenticated", "super", `SELECT password FROM "User"`, "even super admin cannot read password hashes via API");
  await throws(
    "authenticated", "super",
    `INSERT INTO "User" ("id","name","email","password","updatedAt") VALUES ('uX','x','x@x.com','raw', now())`,
    "no API role can insert users (created server-side)",
  );
  {
    await denied("authenticated", "super", `DELETE FROM "User" WHERE id = 'cust1' RETURNING id`, "no API role can delete users (staff trash flow is app-side)");
  }

  // ---------------------------------------------------------------------
  // 10. Other console roles — the fine-grained matrix.
  // ---------------------------------------------------------------------
  console.log("\nOther console roles");
  checkEqual("SEO manager sees 0 orders (not support+)", await selectCount("authenticated", "seo", `"Order"`), 0);
  {
    const r = await run("authenticated", "seo", `UPDATE "Order" SET notes = 'x' WHERE id = 'ord1' RETURNING id`);
    checkEqual("SEO manager cannot update orders (writes = support & above)", r.rows.length, 0);
    const i = await run("authenticated", "inv", `UPDATE "Order" SET notes = 'x' WHERE id = 'ord1' RETURNING id`);
    checkEqual("inventory manager cannot update orders (writes = support & above)", i.rows.length, 0);
  }
  await throws(
    "authenticated", "seo",
    `INSERT INTO "Coupon" ("id","code","type","value") VALUES ('cpnE','SEO','FIXED',1)`,
    "SEO manager cannot create coupons (super admin only)",
  );
  checkEqual("inventory manager sees 0 orders", await selectCount("authenticated", "inv", `"Order"`), 0);
  {
    const r = await run("authenticated", "inv", `UPDATE "ProductVariant" SET stock = 9 WHERE id = 'var1' RETURNING id`);
    checkEqual("inventory manager (staff) can update variants", r.rows.length, 1);
    const p = await run("authenticated", "inv", `UPDATE "Product" SET stock = 9 WHERE id = 'prod1' RETURNING id`);
    checkEqual("inventory manager (staff) can update products", p.rows.length, 1);
    const u = await run("authenticated", "inv", `SELECT id FROM "User" WHERE id = 'cust1'`);
    checkEqual("inventory manager cannot read customer profiles", u.rows.length, 0);
    const s = await run("authenticated", "seo", `UPDATE "SiteSettings" SET "heroTitle" = 'x' WHERE id = 'global' RETURNING id`);
    checkEqual("SEO manager (staff) can update site settings", s.rows.length, 1);
    const c = await run("authenticated", "seo", `UPDATE "Category" SET description = 'x' WHERE id = 'cat1' RETURNING id`);
    checkEqual("staff can update categories", c.rows.length, 1);
  }

  // Trashed accounts lose staff powers (deletedAt set).
  {
    await db.exec(`UPDATE "User" SET "deletedAt" = now() WHERE id = 'support'`);
    checkEqual("trashed staff sees 0 orders (role lookup ignores trash)", await selectCount("authenticated", "support", `"Order"`), 0);
    await db.exec(`UPDATE "User" SET "deletedAt" = NULL WHERE id = 'support'`);
    checkEqual("restored staff sees orders again", await selectCount("authenticated", "support", `"Order"`), 2);
  }

  // ---------------------------------------------------------------------
  // 11. Column privileges on User.
  // ---------------------------------------------------------------------
  console.log("\nColumn-level hardening");
  {
    const r = await db.query(
      `SELECT count(*)::int AS n FROM information_schema.column_privileges
       WHERE table_schema = 'public' AND table_name = 'User'
         AND grantee IN ('anon', 'authenticated') AND privilege_type = 'SELECT'
         AND column_name = 'password'`,
    );
    checkEqual("password column has no SELECT grant for API roles", r.rows[0].n, 0);
  }

  // ---------------------------------------------------------------------
  // 12. Rollback restores the pre-migration state.
  // ---------------------------------------------------------------------
  console.log("\nRollback script (rollback_rls.sql)");
  {
    await db.exec(await readFile(path.join(here, "..", "rollback_rls.sql"), "utf8"));
    const r = await db.query(
      `SELECT count(*)::int AS n FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity`,
    );
    checkEqual("rollback disables RLS on every table", r.rows[0].n, 0);
    const p = await db.query(
      `SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public'`,
    );
    checkEqual("rollback drops every policy", p.rows[0].n, 0);
    const f = await db.query(
      `SELECT count(*)::int AS n FROM pg_proc pr
       JOIN pg_namespace ns ON ns.oid = pr.pronamespace
       WHERE ns.nspname = 'public' AND pr.proname LIKE 'app\\_%'`,
    );
    checkEqual("rollback drops the helper functions", f.rows[0].n, 0);
  }

  // ---------------------------------------------------------------------
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
