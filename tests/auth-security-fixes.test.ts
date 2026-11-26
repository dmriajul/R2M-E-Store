import assert from "node:assert/strict";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { installTestDatabase } from "./support/test-database";
import { UPLOAD_ROOT, UPLOAD_URL_PREFIX } from "../lib/uploads";
import type { PrismaLikeClient } from "../lib/prisma";

const originalEnv = { ...process.env };
const scope = globalThis as typeof globalThis & {
  prisma?: PrismaLikeClient;
  prismaUnavailable?: boolean;
};

const createdLocalFiles: string[] = [];

afterEach(async () => {
  process.env = { ...originalEnv };
  delete scope.prisma;
  delete scope.prismaUnavailable;

  while (createdLocalFiles.length > 0) {
    const filePath = createdLocalFiles.pop()!;
    await rm(filePath, { force: true }).catch(() => {});
  }
});

const VALID_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

function makePngFile(name = "proof.png"): File {
  return new File([VALID_PNG_BYTES], name, { type: "image/png" });
}

function trackUploadedUrl(url: unknown): void {
  const prefix = `${UPLOAD_URL_PREFIX}/`;
  if (typeof url !== "string" || !url.startsWith(prefix)) return;
  const relative = url.slice(prefix.length);
  createdLocalFiles.push(path.join(UPLOAD_ROOT, relative));
}

let testOrderRouteSeq = 0;
function loadTestOrderRoute() {
  testOrderRouteSeq += 1;
  return import(`../app/api/test-order-flow/route?bust=${testOrderRouteSeq}`);
}

let uploadRouteSeq = 0;
function loadUploadRoute() {
  uploadRouteSeq += 1;
  return import(`../app/api/upload/route?bust=${uploadRouteSeq}`);
}

/* -------------------------------------------------------------------------- */
/*  SEC-1 — POST /api/test-order-flow                                         */
/* -------------------------------------------------------------------------- */

test("SEC-1: POST /api/test-order-flow returns 404 in production without creating orders, modifying inventory, or triggering emails", async (context) => {
  process.env = { ...originalEnv, NODE_ENV: "production" };

  let authCalled = false;
  let listProductsCalled = false;
  let createOrderCalled = false;
  let emailCalled = false;

  context.mock.module("../lib/auth", {
    namedExports: {
      requireActionRole: async () => {
        authCalled = true;
        return {
          ok: true,
          user: { id: "sa-1", name: "Super Admin", email: "sa@mukra.com", role: "SUPER_ADMIN" },
        };
      },
    },
  });
  context.mock.module("../lib/data/products", {
    namedExports: {
      listProducts: async () => {
        listProductsCalled = true;
        return { products: [] };
      },
    },
  });
  context.mock.module("../lib/data/orders", {
    namedExports: {
      createOrder: async () => {
        createOrderCalled = true;
        throw new Error("Should not create order in production");
      },
    },
  });
  context.mock.module("../lib/order-email", {
    namedExports: {
      sendOrderConfirmationEmail: async () => {
        emailCalled = true;
      },
    },
  });

  const { POST } = await loadTestOrderRoute();
  const response = await POST(
    new NextRequest("https://mukra.example/api/test-order-flow", { method: "POST" }),
  );

  assert.equal(response.status, 404);
  const body = (await response.json()) as { success: boolean };
  assert.equal(body.success, false);
  assert.equal(authCalled, false);
  assert.equal(listProductsCalled, false);
  assert.equal(createOrderCalled, false);
  assert.equal(emailCalled, false);
});

test("SEC-1: non-production POST /api/test-order-flow rejects unauthenticated, CUSTOMER, and ordinary staff roles before side effects, and allows only SUPER_ADMIN", async (context) => {
  process.env = { ...originalEnv, NODE_ENV: "development" };

  const fixture = installTestDatabase({
    user: [
      {
        id: "u-super",
        name: "Super Admin",
        email: "super@mukra.com",
        password: await hash("SecretPass123!", 10),
        role: "SUPER_ADMIN",
        deletedAt: null,
        emailVerified: null,
      },
      {
        id: "u-inv",
        name: "Inventory Staff",
        email: "inv@mukra.com",
        password: await hash("SecretPass123!", 10),
        role: "INVENTORY_MANAGER",
        deletedAt: null,
        emailVerified: null,
      },
      {
        id: "u-seo",
        name: "SEO Staff",
        email: "seo@mukra.com",
        password: await hash("SecretPass123!", 10),
        role: "SEO_MANAGER",
        deletedAt: null,
        emailVerified: null,
      },
      {
        id: "u-sup",
        name: "Support Staff",
        email: "support@mukra.com",
        password: await hash("SecretPass123!", 10),
        role: "SUPPORT_MANAGER",
        deletedAt: null,
        emailVerified: null,
      },
      {
        id: "u-cust",
        name: "Customer",
        email: "customer@example.com",
        password: await hash("SecretPass123!", 10),
        role: "CUSTOMER",
        deletedAt: null,
        emailVerified: new Date(),
      },
    ],
  });
  Object.assign(globalThis, { prisma: fixture.db });

  const realAuth = await import("../lib/auth");
  let currentSessionUserId: string | null = null;
  let sideEffectOrders = 0;
  let sideEffectInventoryReads = 0;
  let sideEffectEmails = 0;

  context.mock.module("../lib/auth", {
    namedExports: {
      ...realAuth,
      requireActionRole: async (allowedRoles: readonly ("SUPER_ADMIN" | "INVENTORY_MANAGER" | "SEO_MANAGER" | "SUPPORT_MANAGER")[]) => {
        const session = currentSessionUserId ? { user: { id: currentSessionUserId } } : null;
        return realAuth.requireVerifiedRole(session, allowedRoles);
      },
    },
  });
  context.mock.module("../lib/data/products", {
    namedExports: {
      listProducts: async () => {
        sideEffectInventoryReads += 1;
        return {
          products: [
            {
              id: "prod-1",
              name: "Test Outfit",
              colors: ["Gold"],
              sizes: ["4Y"],
              price: 950,
            },
          ],
        };
      },
    },
  });
  context.mock.module("../lib/data/orders", {
    namedExports: {
      createOrder: async () => {
        sideEffectOrders += 1;
        return {
          order: { id: "ord-1", orderNumber: "LL-2026-0001" },
          source: "database",
        };
      },
    },
  });
  context.mock.module("../lib/order-email", {
    namedExports: {
      sendOrderConfirmationEmail: async () => {
        sideEffectEmails += 1;
      },
    },
  });

  const { POST } = await loadTestOrderRoute();

  // 1. Unauthenticated -> 401, zero side effects
  currentSessionUserId = null;
  const unauthRes = await POST(new NextRequest("http://localhost:3000/api/test-order-flow", { method: "POST" }));
  assert.equal(unauthRes.status, 401);
  assert.equal(sideEffectOrders, 0);
  assert.equal(sideEffectInventoryReads, 0);
  assert.equal(sideEffectEmails, 0);

  // 2. CUSTOMER and all non-SUPER_ADMIN staff roles -> 403, zero side effects
  for (const deniedUserId of ["u-cust", "u-inv", "u-seo", "u-sup"]) {
    currentSessionUserId = deniedUserId;
    const deniedRes = await POST(
      new NextRequest("http://localhost:3000/api/test-order-flow", {
        method: "POST",
        headers: { "x-forwarded-for": `10.0.0.${deniedUserId.length}` },
      }),
    );
    assert.equal(deniedRes.status, 403, `Expected 403 for ${deniedUserId}`);
    assert.equal(sideEffectOrders, 0);
    assert.equal(sideEffectInventoryReads, 0);
    assert.equal(sideEffectEmails, 0);
  }

  // 3. Active SUPER_ADMIN -> 200 and executes test order flow
  currentSessionUserId = "u-super";
  const allowedRes = await POST(
    new NextRequest("http://localhost:3000/api/test-order-flow", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.1.1" },
    }),
  );
  assert.equal(allowedRes.status, 200);
  const allowedBody = (await allowedRes.json()) as { orderCreated: boolean; stockDeducted: boolean; orderNumber: string };
  assert.equal(allowedBody.orderCreated, true);
  assert.equal(allowedBody.stockDeducted, true);
  assert.equal(allowedBody.orderNumber, "LL-2026-0001");
  assert.equal(sideEffectOrders, 1);
  assert.equal(sideEffectInventoryReads, 1);

  // 4. Demoted SUPER_ADMIN in DB -> immediately rejected with 403
  await fixture.db.user.update({ where: { id: "u-super" }, data: { role: "SUPPORT_MANAGER" } });
  const demotedRes = await POST(
    new NextRequest("http://localhost:3000/api/test-order-flow", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.1.2" },
    }),
  );
  assert.equal(demotedRes.status, 403);
  assert.equal(sideEffectOrders, 1);
});

/* -------------------------------------------------------------------------- */
/*  SEC-2 — POST /api/upload                                                  */
/* -------------------------------------------------------------------------- */

test("SEC-2: POST /api/upload rejects unauthenticated callers, unauthorized purposes/folders, and non-owned return orders while preserving legitimate uploads", async (context) => {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;

  const fixture = installTestDatabase({
    user: [
      {
        id: "cust-owner",
        name: "Order Owner",
        email: "owner@example.com",
        password: await hash("SecretPass123!", 10),
        role: "CUSTOMER",
        deletedAt: null,
        emailVerified: new Date(),
      },
      {
        id: "cust-other",
        name: "Other Shopper",
        email: "other@example.com",
        password: await hash("SecretPass123!", 10),
        role: "CUSTOMER",
        deletedAt: null,
        emailVerified: new Date(),
      },
      {
        id: "staff-inv",
        name: "Inventory Manager",
        email: "inv@mukra.com",
        password: await hash("SecretPass123!", 10),
        role: "INVENTORY_MANAGER",
        deletedAt: null,
        emailVerified: null,
      },
      {
        id: "staff-seo",
        name: "SEO Manager",
        email: "seo@mukra.com",
        password: await hash("SecretPass123!", 10),
        role: "SEO_MANAGER",
        deletedAt: null,
        emailVerified: null,
      },
    ],
    order: [
      {
        id: "order-delivered-owner",
        orderNumber: "LL-2026-1001",
        userId: "cust-owner",
        status: "DELIVERED",
      },
      {
        id: "order-pending-owner",
        orderNumber: "LL-2026-1002",
        userId: "cust-owner",
        status: "PROCESSING",
      },
      {
        id: "order-delivered-other",
        orderNumber: "LL-2026-1003",
        userId: "cust-other",
        status: "DELIVERED",
      },
    ],
  });
  Object.assign(globalThis, { prisma: fixture.db });

  const realAuth = await import("../lib/auth");
  let activeUserId: string | null = null;

  context.mock.module("../lib/auth", {
    namedExports: {
      ...realAuth,
      getVerifiedSessionUser: async () =>
        realAuth.getVerifiedSessionUser(activeUserId ? { user: { id: activeUserId } } : null),
      requireActionRole: async (allowedRoles: readonly ("SUPER_ADMIN" | "INVENTORY_MANAGER" | "SEO_MANAGER" | "SUPPORT_MANAGER")[]) =>
        realAuth.requireVerifiedRole(activeUserId ? { user: { id: activeUserId } } : null, allowedRoles),
    },
  });

  const { POST } = await loadUploadRoute();

  async function sendUpload(
    query: string,
    fields: Record<string, string | File>,
    ip = "198.51.100.10",
  ) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    return POST(
      new NextRequest(`http://localhost:3000/api/upload${query}`, {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: form,
      }),
    );
  }

  // 1. Unauthenticated requests -> 401 across all purposes
  activeUserId = null;
  for (const query of ["", "?purpose=payment", "?purpose=return", "?purpose=hero"]) {
    const res = await sendUpload(query, { file: makePngFile(), folder: "mukra/payments" });
    assert.equal(res.status, 401, `Expected 401 for unauthenticated ${query || "(no query)"}`);
  }

  // 2. Unauthorized hero upload attempts (including case variation and folder smuggling) -> 403
  activeUserId = "cust-owner";
  assert.equal((await sendUpload("?purpose=hero", { file: makePngFile() })).status, 403);
  assert.equal((await sendUpload("?purpose=HERO", { file: makePngFile() })).status, 403);
  assert.equal((await sendUpload("", { file: makePngFile(), folder: "mukra/hero" })).status, 403);

  activeUserId = "staff-inv"; // lacks settings:write
  assert.equal((await sendUpload("?purpose=hero", { file: makePngFile() })).status, 403);

  // 3. Alternative / unapproved purposes & folders -> rejected (never falls back to general uploads)
  activeUserId = "cust-owner";
  for (const badQuery of ["?purpose=public", "?purpose=uploads", "?purpose=products", "?purpose=banners", "?purpose="]) {
    const res = await sendUpload(badQuery, { file: makePngFile() });
    assert.equal(res.status, 403, `Expected 403 for ${badQuery}`);
  }
  assert.equal((await sendUpload("", { file: makePngFile() })).status, 400);
  assert.equal((await sendUpload("", { file: makePngFile(), folder: "mukra/products" })).status, 403);
  assert.equal((await sendUpload("", { file: makePngFile(), folder: "uploads" })).status, 403);
  assert.equal((await sendUpload("?purpose=payment", { file: makePngFile(), folder: "mukra/returns" })).status, 400);

  // 4. Return evidence ownership enforcement
  activeUserId = "cust-owner";
  // Missing orderId -> 400
  assert.equal(
    (await sendUpload("?purpose=return", { file: makePngFile(), folder: "mukra/returns" })).status,
    400,
  );
  // Another customer's delivered order -> 403
  assert.equal(
    (
      await sendUpload("?purpose=return", {
        file: makePngFile(),
        folder: "mukra/returns",
        orderId: "order-delivered-other",
      })
    ).status,
    403,
  );
  // Own non-delivered order -> 403
  assert.equal(
    (
      await sendUpload("?purpose=return", {
        file: makePngFile(),
        folder: "mukra/returns",
        orderId: "order-pending-owner",
      })
    ).status,
    403,
  );

  // 5. Legitimate return evidence upload for own DELIVERED order -> 201 in returns bucket
  const returnOk = await sendUpload("?purpose=return", {
    file: makePngFile("return-proof.png"),
    folder: "mukra/returns",
    orderId: "order-delivered-owner",
  });
  assert.equal(returnOk.status, 201);
  const returnBody = (await returnOk.json()) as { success: boolean; data: { url: string; publicId: string } };
  assert.equal(returnBody.success, true);
  trackUploadedUrl(returnBody.data.url);
  assert.match(returnBody.data.url, /^\/uploads\/returns\//);

  // 6. Legitimate checkout payment screenshot upload -> 201 in payments bucket
  const paymentOk = await sendUpload("?purpose=payment", {
    file: makePngFile("bkash-proof.png"),
    folder: "mukra/payments",
  });
  assert.equal(paymentOk.status, 201);
  const paymentBody = (await paymentOk.json()) as { success: boolean; data: { url: string } };
  assert.equal(paymentBody.success, true);
  trackUploadedUrl(paymentBody.data.url);
  assert.match(paymentBody.data.url, /^\/uploads\/payments\//);

  // 7. Legitimate admin hero upload by SEO_MANAGER -> 201 in hero bucket
  activeUserId = "staff-seo";
  const heroOk = await sendUpload("?purpose=hero", {
    file: makePngFile("hero-banner.png"),
  });
  assert.equal(heroOk.status, 201);
  const heroBody = (await heroOk.json()) as { success: boolean; data: { url: string } };
  assert.equal(heroBody.success, true);
  trackUploadedUrl(heroBody.data.url);
  assert.match(heroBody.data.url, /^\/uploads\/hero\//);
});

test("F-1 (SEC-2): prototype-key purposes/folders, invalid mixed combinations, and invalid return orders are rejected without reaching Cloudinary or local storage", async (context) => {
  async function snapshotLocalUploads(): Promise<string[]> {
    const entries: string[] = [];
    async function walk(dir: string): Promise<void> {
      let dirents;
      try {
        dirents = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of dirents) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else {
          entries.push(path.relative(UPLOAD_ROOT, full));
        }
      }
    }
    await walk(UPLOAD_ROOT);
    return entries.sort();
  }

  const fixture = installTestDatabase({
    user: [
      {
        id: "f1-no-orders",
        name: "No Orders Shopper",
        email: "no-orders@example.com",
        password: await hash("SecretPass123!", 10),
        role: "CUSTOMER",
        deletedAt: null,
        emailVerified: new Date(),
      },
      {
        id: "f1-owner",
        name: "Order Owner",
        email: "f1-owner@example.com",
        password: await hash("SecretPass123!", 10),
        role: "CUSTOMER",
        deletedAt: null,
        emailVerified: new Date(),
      },
      {
        id: "f1-other",
        name: "Other Shopper",
        email: "f1-other@example.com",
        password: await hash("SecretPass123!", 10),
        role: "CUSTOMER",
        deletedAt: null,
        emailVerified: new Date(),
      },
    ],
    order: [
      {
        id: "f1-order-delivered",
        orderNumber: "LL-2026-2001",
        userId: "f1-owner",
        status: "DELIVERED",
      },
      {
        id: "f1-order-processing",
        orderNumber: "LL-2026-2002",
        userId: "f1-owner",
        status: "PROCESSING",
      },
      {
        id: "f1-order-other-delivered",
        orderNumber: "LL-2026-2003",
        userId: "f1-other",
        status: "DELIVERED",
      },
    ],
  });
  Object.assign(globalThis, { prisma: fixture.db });

  const realAuth = await import("../lib/auth");
  let activeUserId: string | null = "f1-no-orders";
  let cloudinaryCalls = 0;

  context.mock.module("../lib/auth", {
    namedExports: {
      ...realAuth,
      getVerifiedSessionUser: async () =>
        realAuth.getVerifiedSessionUser(activeUserId ? { user: { id: activeUserId } } : null),
      requireActionRole: async (
        allowedRoles: readonly ("SUPER_ADMIN" | "INVENTORY_MANAGER" | "SEO_MANAGER" | "SUPPORT_MANAGER")[],
      ) => realAuth.requireVerifiedRole(activeUserId ? { user: { id: activeUserId } } : null, allowedRoles),
    },
  });
  context.mock.module("../lib/cloudinary", {
    namedExports: {
      uploadToCloudinary: async () => {
        cloudinaryCalls += 1;
        return {
          url: "https://res.cloudinary.com/demo/image/upload/v1/mukra/test.png",
          publicId: "mukra/test",
          bytes: 128,
        };
      },
    },
  });

  const { POST } = await loadUploadRoute();
  let ipCounter = 1;

  async function postForm(query: string, entries: Array<[string, string | File]>) {
    const form = new FormData();
    for (const [k, v] of entries) {
      form.append(k, v);
    }
    const oct = ipCounter++;
    return POST(
      new NextRequest(`http://localhost:3000/api/upload${query}`, {
        method: "POST",
        headers: { "x-forwarded-for": `203.0.113.${oct}` },
        body: form,
      }),
    );
  }

  // Test prototype-key & invalid mixed combinations under BOTH Cloudinary-enabled
  // and local-disk modes to prove neither storage backend is ever invoked.
  for (const mode of ["cloudinary", "local"] as const) {
    if (mode === "cloudinary") {
      process.env.CLOUDINARY_CLOUD_NAME = "demo-cloud";
      process.env.CLOUDINARY_API_KEY = "demo-key";
      process.env.CLOUDINARY_API_SECRET = "demo-secret";
    } else {
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;
    }

    const beforeFiles = await snapshotLocalUploads();
    const beforeCloudinary = cloudinaryCalls;

    // 1. Prototype-key query and form purpose / folder bypass vectors -> 403
    for (const [query, fields] of [
      ["?purpose=constructor", [["file", makePngFile()]]],
      ["?purpose=CONSTRUCTOR", [["file", makePngFile()]]],
      ["?purpose=__proto__", [["file", makePngFile()]]],
      ["?purpose=toString", [["file", makePngFile()]]],
      ["?purpose=valueOf", [["file", makePngFile()]]],
      ["", [["file", makePngFile()], ["purpose", "constructor"]]],
      ["", [["file", makePngFile()], ["purpose", "__proto__"]]],
      ["", [["file", makePngFile()], ["folder", "constructor"]]],
      ["", [["file", makePngFile()], ["folder", "__proto__"]]],
      ["", [["file", makePngFile()], ["folder", "toString"]]],
      ["?purpose=payment", [["file", makePngFile()], ["folder", "constructor"]]],
      ["?purpose=constructor", [["file", makePngFile()], ["folder", "mukra/payments"]]],
      ["?purpose=payment&purpose=constructor", [["file", makePngFile()]]],
      ["", [["file", makePngFile()], ["purpose", "payment"], ["purpose", "constructor"]]],
    ] as Array<[string, Array<[string, string | File]>]>) {
      const res = await postForm(query, fields);
      assert.equal(res.status, 403, `Expected 403 in ${mode} mode for query=${query}`);
    }

    // 2. Invalid mixed purpose/folder combinations -> 4xx
    for (const [expectedStatus, query, fields] of [
      [400, "?purpose=payment", [["file", makePngFile()], ["folder", "mukra/returns"]]],
      [400, "?purpose=return", [["file", makePngFile()], ["folder", "mukra/payments"]]],
      [400, "?purpose=payment", [["file", makePngFile()], ["purpose", "return"]]],
      [400, "?purpose=payment&purpose=return", [["file", makePngFile()]]],
      [403, "?purpose=payment", [["file", makePngFile()], ["folder", "mukra/products"]]],
      [403, "", [["file", makePngFile()], ["purpose", "   "], ["folder", "mukra/payments"]]],
    ] as Array<[number, string, Array<[string, string | File]>]>) {
      const res = await postForm(query, fields);
      assert.equal(res.status, expectedStatus, `Expected ${expectedStatus} in ${mode} mode for query=${query}`);
    }

    assert.equal(cloudinaryCalls, beforeCloudinary, `Cloudinary must not be called in ${mode} mode`);
    assert.deepEqual(await snapshotLocalUploads(), beforeFiles, `Local storage must not be written in ${mode} mode`);
  }

  // Switch to local storage for end-to-end return & payment validation assertions
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
  activeUserId = "f1-owner";

  const beforeReturnRejections = await snapshotLocalUploads();

  // 3. Return upload with missing, malformed, or non-existent orderId -> rejected without storage writes
  assert.equal(
    (await postForm("?purpose=return", [["file", makePngFile()], ["folder", "mukra/returns"]])).status,
    400,
  );
  assert.equal(
    (await postForm("?purpose=return", [["file", makePngFile()], ["folder", "mukra/returns"], ["orderId", "   "]])).status,
    400,
  );
  assert.equal(
    (await postForm("?purpose=return", [["file", makePngFile()], ["folder", "mukra/returns"], ["orderId", "bad\u0000id"]])).status,
    400,
  );
  assert.equal(
    (
      await postForm("?purpose=return", [
        ["file", makePngFile()],
        ["folder", "mukra/returns"],
        ["orderId", "non-existent-order-id"],
      ])
    ).status,
    403,
  );

  // 4. Return upload for another user's delivered order -> 403
  assert.equal(
    (
      await postForm("?purpose=return", [
        ["file", makePngFile()],
        ["folder", "mukra/returns"],
        ["orderId", "f1-order-other-delivered"],
      ])
    ).status,
    403,
  );

  // 5. Return upload for own non-delivered order -> 403
  assert.equal(
    (
      await postForm("?purpose=return", [
        ["file", makePngFile()],
        ["folder", "mukra/returns"],
        ["orderId", "f1-order-processing"],
      ])
    ).status,
    403,
  );

  assert.equal(cloudinaryCalls, 0);
  assert.deepEqual(await snapshotLocalUploads(), beforeReturnRejections);

  // 6. Valid payment upload -> 201 in payments bucket
  const validPayment = await postForm("?purpose=payment", [
    ["file", makePngFile("f1-payment.png")],
    ["folder", "mukra/payments"],
  ]);
  assert.equal(validPayment.status, 201);
  const validPaymentBody = (await validPayment.json()) as { success: boolean; data: { url: string } };
  assert.equal(validPaymentBody.success, true);
  trackUploadedUrl(validPaymentBody.data.url);
  assert.match(validPaymentBody.data.url, /^\/uploads\/payments\//);

  // 7. Valid return upload with correct ownership and DELIVERED status -> 201 in returns bucket
  const validReturn = await postForm("?purpose=return", [
    ["file", makePngFile("f1-return.png")],
    ["folder", "mukra/returns"],
    ["orderId", "f1-order-delivered"],
  ]);
  assert.equal(validReturn.status, 201);
  const validReturnBody = (await validReturn.json()) as { success: boolean; data: { url: string } };
  assert.equal(validReturnBody.success, true);
  trackUploadedUrl(validReturnBody.data.url);
  assert.match(validReturnBody.data.url, /^\/uploads\/returns\//);
});

/* -------------------------------------------------------------------------- */
/*  EP-2 — JWT Session & Database Role/Status Revalidation                    */
/* -------------------------------------------------------------------------- */

test("EP-2: revalidateJwtToken enforces interval caching, refreshes roles/demotions, invalidates deleted/missing/unverified users, and adds no extra PII", async () => {
  const fixture = installTestDatabase({
    user: [
      {
        id: "ep2-admin",
        name: "Active Staff",
        email: "staff@mukra.com",
        password: await hash("SecretPass123!", 10),
        role: "SUPER_ADMIN",
        deletedAt: null,
        emailVerified: new Date("2026-10-01T00:00:00.000Z"),
      },
      {
        id: "ep2-legacy-staff",
        name: "Legacy Staff",
        email: "legacy@mukra.com",
        password: await hash("SecretPass123!", 10),
        role: "SEO_MANAGER",
        deletedAt: null,
        emailVerified: null,
      },
    ],
  });
  Object.assign(globalThis, { prisma: fixture.db });

  const { JWT_REVALIDATION_INTERVAL_MS, revalidateJwtToken } = await import("../lib/auth");

  let findUniqueCalls = 0;
  const origFindUnique = fixture.db.user.findUnique;
  fixture.db.user.findUnique = async (args) => {
    findUniqueCalls += 1;
    return origFindUnique(args);
  };

  const t0 = 1_700_000_000_000;

  // 1. Initial sign-in stamps revalidatedAt without extra DB read or extra PII/secrets
  const initialToken = await revalidateJwtToken(
    {
      token: {},
      user: {
        id: "ep2-admin",
        name: "Active Staff",
        email: "staff@mukra.com",
        role: "SUPER_ADMIN",
        emailVerified: true,
      },
    } as Parameters<typeof revalidateJwtToken>[0],
    { now: t0 },
  );
  assert.ok(initialToken);
  assert.equal(initialToken.revalidatedAt, t0);
  assert.equal(initialToken.role, "SUPER_ADMIN");
  assert.equal("password" in initialToken, false);
  assert.equal(findUniqueCalls, 0);

  // 2. Within revalidation interval (t0 + 30s < 60s): skips DB query
  const cachedToken = await revalidateJwtToken(
    { token: { ...initialToken } } as Parameters<typeof revalidateJwtToken>[0],
    { now: t0 + 30_000 },
  );
  assert.ok(cachedToken);
  assert.equal(cachedToken.role, "SUPER_ADMIN");
  assert.equal(findUniqueCalls, 0);

  // 3. Role change / demotion in DB detected once interval elapses (t0 + 60s)
  await fixture.db.user.update({
    where: { id: "ep2-admin" },
    data: { role: "SUPPORT_MANAGER" },
  });
  const demotedStaffToken = await revalidateJwtToken(
    { token: { ...initialToken } } as Parameters<typeof revalidateJwtToken>[0],
    { now: t0 + JWT_REVALIDATION_INTERVAL_MS },
  );
  assert.ok(demotedStaffToken);
  assert.equal(demotedStaffToken.role, "SUPPORT_MANAGER");
  assert.equal(demotedStaffToken.revalidatedAt, t0 + JWT_REVALIDATION_INTERVAL_MS);
  assert.equal(findUniqueCalls, 1);

  // 4. Demotion to CUSTOMER with verified email updates role to CUSTOMER
  await fixture.db.user.update({
    where: { id: "ep2-admin" },
    data: { role: "CUSTOMER" },
  });
  const customerToken = await revalidateJwtToken(
    { token: { ...demotedStaffToken } } as Parameters<typeof revalidateJwtToken>[0],
    { now: t0 + JWT_REVALIDATION_INTERVAL_MS * 2 },
  );
  assert.ok(customerToken);
  assert.equal(customerToken.role, "CUSTOMER");
  assert.equal(findUniqueCalls, 2);

  // 5. Staff demoted to CUSTOMER without verified email -> invalidated (preserves email-verification requirement!)
  const legacySignIn = await revalidateJwtToken(
    {
      token: {},
      user: {
        id: "ep2-legacy-staff",
        name: "Legacy Staff",
        email: "legacy@mukra.com",
        role: "SEO_MANAGER",
        emailVerified: false,
      },
    } as Parameters<typeof revalidateJwtToken>[0],
    { now: t0 },
  );
  assert.ok(legacySignIn);
  await fixture.db.user.update({
    where: { id: "ep2-legacy-staff" },
    data: { role: "CUSTOMER" },
  });
  const unverifiedDemoted = await revalidateJwtToken(
    { token: { ...legacySignIn } } as Parameters<typeof revalidateJwtToken>[0],
    { now: t0 + JWT_REVALIDATION_INTERVAL_MS },
  );
  assert.equal(unverifiedDemoted, null);

  // 6. Soft-deleted user (deletedAt != null) -> invalidated immediately on trigger="update" or interval
  await fixture.db.user.update({
    where: { id: "ep2-admin" },
    data: { deletedAt: new Date() },
  });
  const softDeletedToken = await revalidateJwtToken(
    {
      token: { ...customerToken },
      trigger: "update",
    } as Parameters<typeof revalidateJwtToken>[0],
    { now: t0 + JWT_REVALIDATION_INTERVAL_MS * 2 + 1_000 },
  );
  assert.equal(softDeletedToken, null);

  // 7. Missing / permanently deleted user -> invalidated
  await fixture.db.user.delete({ where: { id: "ep2-admin" } });
  const missingUserToken = await revalidateJwtToken(
    { token: { ...customerToken } } as Parameters<typeof revalidateJwtToken>[0],
    { now: t0 + JWT_REVALIDATION_INTERVAL_MS * 3 },
  );
  assert.equal(missingUserToken, null);
});

test("EP-2: database errors fail closed across revalidateSessionUser, revalidateJwtToken, and sensitive admin role checks", async (context) => {
  context.mock.method(console, "error", () => {});

  const fixture = installTestDatabase({
    user: [
      {
        id: "ep2-live-admin",
        name: "Live Admin",
        email: "admin@mukra.com",
        password: await hash("SecretPass123!", 10),
        role: "SUPER_ADMIN",
        deletedAt: null,
        emailVerified: null,
      },
    ],
  });
  Object.assign(globalThis, { prisma: fixture.db });

  const {
    JWT_REVALIDATION_INTERVAL_MS,
    revalidateSessionUser,
    revalidateJwtToken,
    requireVerifiedRole,
  } = await import("../lib/auth");

  // 1. Even with a fresh cached SUPER_ADMIN session object, sensitive admin checks
  //    immediately detect DB demotion or soft-deletion without waiting for JWT TTL.
  const cachedSuperAdminSession = {
    user: { id: "ep2-live-admin", name: "Live Admin", email: "admin@mukra.com", role: "SUPER_ADMIN" },
  };
  assert.equal((await requireVerifiedRole(cachedSuperAdminSession, ["SUPER_ADMIN"])).ok, true);

  await fixture.db.user.update({
    where: { id: "ep2-live-admin" },
    data: { role: "INVENTORY_MANAGER" },
  });
  const afterDemotion = await requireVerifiedRole(cachedSuperAdminSession, ["SUPER_ADMIN"]);
  assert.equal(afterDemotion.ok, false);
  if (!afterDemotion.ok) {
    assert.equal(afterDemotion.reason, "forbidden");
  }
  const allowedInventory = await requireVerifiedRole(cachedSuperAdminSession, ["INVENTORY_MANAGER"]);
  assert.equal(allowedInventory.ok, true);
  if (allowedInventory.ok) {
    assert.equal(allowedInventory.user.role, "INVENTORY_MANAGER");
  }

  await fixture.db.user.update({
    where: { id: "ep2-live-admin" },
    data: { deletedAt: new Date() },
  });
  const afterSoftDelete = await requireVerifiedRole(cachedSuperAdminSession, ["INVENTORY_MANAGER"]);
  assert.equal(afterSoftDelete.ok, false);
  if (!afterSoftDelete.ok) {
    assert.equal(afterSoftDelete.reason, "unauthenticated");
  }

  // 2. Simulated database outage fails closed — never grants access by default.
  fixture.db.user.findUnique = async () => {
    throw new Error("simulated database connection failure");
  };

  const revalOutage = await revalidateSessionUser("ep2-live-admin");
  assert.equal(revalOutage.status, "error");

  const jwtOutage = await revalidateJwtToken(
    {
      token: {
        id: "ep2-live-admin",
        sub: "ep2-live-admin",
        role: "SUPER_ADMIN",
        revalidatedAt: 1_000,
      },
    } as Parameters<typeof revalidateJwtToken>[0],
    { now: 1_000 + JWT_REVALIDATION_INTERVAL_MS + 1 },
  );
  assert.equal(jwtOutage, null);

  const gateOutage = await requireVerifiedRole(cachedSuperAdminSession, ["SUPER_ADMIN"]);
  assert.equal(gateOutage.ok, false);
  if (!gateOutage.ok) {
    assert.equal(gateOutage.reason, "unauthenticated");
  }
});

test("EP-2: NextAuth /api/auth/session refreshes demoted roles and clears cookies for deleted accounts after the revalidation interval", async (context) => {
  context.mock.method(console, "warn", () => {});
  context.mock.method(console, "error", () => {});

  process.env = {
    ...originalEnv,
    NODE_ENV: "development",
    AUTH_SECRET: "ep2-http-session-revalidation-secret-32ch",
    AUTH_URL: "http://localhost:3000",
    NEXTAUTH_URL: "http://localhost:3000",
    TURNSTILE_SECRET_KEY: "ep2-turnstile-secret",
  };
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({ success: true, action: "login", hostname: "localhost" }),
  );

  const fixture = installTestDatabase({
    user: [
      {
        id: "ep2-http-admin",
        name: "Console Admin",
        email: "console-admin@mukra.com",
        password: await hash("SecretPass123!", 10),
        role: "SUPER_ADMIN",
        deletedAt: null,
        emailVerified: null,
      },
    ],
  });
  Object.assign(globalThis, { prisma: fixture.db });

  const { handlers, JWT_REVALIDATION_INTERVAL_MS } = await import("../lib/auth");

  let fakeNow = Date.now();
  context.mock.method(Date, "now", () => fakeNow);

  const csrfRes = await handlers.GET(new NextRequest("http://localhost:3000/api/auth/csrf"));
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookie = csrfRes.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");

  const loginRes = await handlers.POST(
    new NextRequest("http://localhost:3000/api/auth/callback/credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
        cookie: csrfCookie,
      },
      body: new URLSearchParams({
        email: "console-admin@mukra.com",
        password: "SecretPass123!",
        "cf-turnstile-response": "solved-token",
        csrfToken,
        callbackUrl: "http://localhost:3000/admin",
      }).toString(),
    }),
  );
  let sessionCookie = loginRes.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");

  // Demote in DB and advance past JWT_REVALIDATION_INTERVAL_MS -> session reflects new role
  await fixture.db.user.update({
    where: { id: "ep2-http-admin" },
    data: { role: "SUPPORT_MANAGER" },
  });
  fakeNow += JWT_REVALIDATION_INTERVAL_MS + 5_000;

  const demotedSessionRes = await handlers.GET(
    new NextRequest("http://localhost:3000/api/auth/session", {
      headers: { cookie: `${csrfCookie}; ${sessionCookie}` },
    }),
  );
  const demotedSession = (await demotedSessionRes.json()) as { user?: { role: string } } | null;
  assert.equal(demotedSession?.user?.role, "SUPPORT_MANAGER");
  const refreshedSetCookie = demotedSessionRes.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  if (refreshedSetCookie) {
    sessionCookie = refreshedSetCookie;
  }

  // Soft-delete in DB and advance past interval -> session becomes null & cookie is cleared
  await fixture.db.user.update({
    where: { id: "ep2-http-admin" },
    data: { deletedAt: new Date(fakeNow) },
  });
  fakeNow += JWT_REVALIDATION_INTERVAL_MS + 5_000;

  const revokedSessionRes = await handlers.GET(
    new NextRequest("http://localhost:3000/api/auth/session", {
      headers: { cookie: `${csrfCookie}; ${sessionCookie}` },
    }),
  );
  assert.equal(await revokedSessionRes.json(), null);
  assert.ok(
    revokedSessionRes.headers
      .getSetCookie()
      .some(
        (header) =>
          header.includes("session-token=") &&
          (header.includes("Max-Age=0") || header.includes("Expires=Thu, 01 Jan 1970")),
      ),
  );
});
