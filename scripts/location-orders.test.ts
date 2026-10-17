import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { statSync } from "node:fs";
import postalCodes from "../lib/data/bangladesh-postal-codes.json";
import { canonicalDistrict, lookupPostalLocations, reverseLocation, searchLocations } from "../lib/geocoding";
import { getAdminOrders, type toAdminOrder } from "../lib/data/admin-orders";
import { createOrder } from "../lib/data/orders";
import { withDatabase, type PrismaDelegate, type PrismaLikeClient } from "../lib/prisma";
import { BANGLADESH_DIVISIONS } from "../lib/bangladesh-locations";
import type { CreateOrderInput } from "../types";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const scope = globalThis as typeof globalThis & { prisma?: PrismaLikeClient; prismaUnavailable?: boolean };
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of ["DATABASE_URL", "LOCATIONIQ_API_KEY", "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN"]) {
    if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
  delete scope.prisma;
  delete scope.prismaUnavailable;
});

function mockFetch(mapboxResult: unknown, iqResult: unknown, mapboxStatus = 200) {
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "test-mapbox-token";
  process.env.LOCATIONIQ_API_KEY = "test-private-key";
  const urls: URL[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    return Response.json(url.hostname === "api.mapbox.com" ? mapboxResult : iqResult, { status: url.hostname === "api.mapbox.com" ? mapboxStatus : 200 });
  };
  return urls;
}
const mapboxFeature = (relevance: number, text = "Dhanmondi") => ({
  id: "locality.test", text, place_name: `${text}, Dhaka, Bangladesh`, center: [90.38, 23.74], relevance,
  context: [{ id: "district.dhaka", text: "Dhaka" }, { id: "locality.thana", text: "Dhanmondi" }],
});
const iqFeature = { place_id: 123, display_name: "Rural test, Khulna, Bangladesh", lon: "89.50622", lat: "22.91597", address: { country_code: "bd", village: "Rural test", state_district: "Khulna District", state: "Khulna Division", postcode: "9204" } };

test("postal dataset: >=1000 unique valid records, <2MB, all checkout districts recognized", () => {
  assert.ok(postalCodes.length >= 1000);
  assert.equal(new Set(postalCodes.map((p) => p.code)).size, postalCodes.length);
  assert.ok(statSync("lib/data/bangladesh-postal-codes.json").size < 2_000_000);
  for (const row of postalCodes) {
    assert.match(row.code, /^\d{4}$/);
    assert.ok(row.latitude >= 20 && row.latitude <= 27 && row.longitude >= 88 && row.longitude <= 93);
    assert.ok(BANGLADESH_DIVISIONS.some((division) => division.name === row.division && division.districts.some((district) => district.name === row.district)), row.code);
  }
});

test("9204 resolves Khulna, Shiromoni, actual source thana and locality coordinates", () => {
  const result = lookupPostalLocations("9204")[0]!;
  assert.equal(result.address.city, "Khulna");
  assert.equal(result.address.state, "Khulna Division");
  assert.equal(result.address.address1, "Shiromoni");
  assert.equal(result.address.address2, "Khulna Sadar");
  assert.equal(result.address.postalCode, "9204");
  assert.deepEqual(result.center, [89.50622, 22.91597]);
  assert.equal(result.approximate, false);
});

test("Shiromoni aliases and Bengali names resolve without network", () => {
  for (const query of ["Shiromoni", "shiromoni", "Siramani", "Siromoni", "শিরোমনি", "শিরোমণি"]) assert.equal(lookupPostalLocations(query)[0]?.address.postalCode, "9204");
});

test("postal lookup and unknown codes never call providers", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Should not fetch"); };
  assert.equal((await searchLocations("9204"))[0]?.address.postalCode, "9204");
  assert.deepEqual(await searchLocations("9999"), []);
  assert.equal(calls, 0);
});

test("major city search keeps confident Mapbox results, without LocationIQ request", async () => {
  const urls = mockFetch({ features: [mapboxFeature(0.9)] }, []);
  const result = await searchLocations("Dhanmondi");
  assert.equal(result[0]?.source, "mapbox");
  assert.equal(result[0]?.address.address2, "Dhanmondi");
  assert.equal(urls.length, 1);
  assert.equal(urls[0]?.searchParams.get("country"), "bd");
});

test("low-confidence Mapbox results fall back to LocationIQ and normalize address", async () => {
  const urls = mockFetch({ features: [mapboxFeature(0.6)] }, [iqFeature]);
  const result = await searchLocations("Dhanmondi");
  assert.equal(result[0]?.source, "locationiq");
  assert.equal(result[0]?.address.city, "Khulna");
  assert.equal(result[0]?.address.state, "Khulna Division");
  assert.equal(urls[1]?.searchParams.get("countrycodes"), "bd");
});

test("Mapbox HTTP failure also falls back, not only zero results", async () => {
  const urls = mockFetch({}, [iqFeature], 503);
  assert.equal((await searchLocations("Remote test"))[0]?.source, "locationiq");
  assert.equal(urls.length, 2);
});

test("zero Mapbox results trigger LocationIQ fallback", async () => {
  // Allow the production per-second burst safeguard to reset between cases.
  await new Promise((resolve) => setTimeout(resolve, 1050));
  const urls = mockFetch({ features: [] }, [iqFeature]);
  assert.equal((await searchLocations("Remote village"))[0]?.source, "locationiq");
  assert.equal(urls.length, 2);
});

test("unrelated Baridhara match cannot replace Shiromoni even with high relevance", async () => {
  mockFetch({ features: [mapboxFeature(1, "Baridhara DOHS")] }, []);
  const result = await searchLocations("Shiromoni");
  assert.equal(result[0]?.source, "postal");
  assert.equal(result[0]?.address.city, "Khulna");
  assert.ok(!result.some((r) => r.placeName.includes("Baridhara")));
});

test("missing provider keys retain local postal search and return empty for unknown areas", async () => {
  delete process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  delete process.env.LOCATIONIQ_API_KEY;
  assert.equal((await searchLocations("Shiromoni"))[0]?.address.postalCode, "9204");
  assert.deepEqual(await searchLocations("Unknown place xyz"), []);
});

test("reverse Mapbox lookup maps district/thana without the old precedence bug", async () => {
  mockFetch({ features: [mapboxFeature(1)] }, []);
  const result = await reverseLocation(90.38, 23.74);
  assert.equal(result[0]?.address.address2, "Dhanmondi");
  assert.equal(result[0]?.address.city, "Dhaka");
});

test("provider district spellings map to checkout options", () => {
  assert.equal(canonicalDistrict("Khulna District"), "Khulna");
  assert.equal(canonicalDistrict("Chattogram"), "Chittagong");
  assert.equal(canonicalDistrict("Cumilla"), "Comilla");
  assert.equal(canonicalDistrict("Jessore"), "Jashore");
});

function delegate(): PrismaDelegate {
  const unsupported = async (): Promise<never> => { throw new Error("Unexpected database call"); };
  return { findMany: unsupported, findUnique: unsupported, findFirst: unsupported, create: unsupported, update: unsupported, upsert: unsupported, delete: unsupported, updateMany: unsupported, deleteMany: unsupported, count: unsupported };
}
function database(): PrismaLikeClient {
  process.env.DATABASE_URL = "postgresql://test-not-real";
  const db: PrismaLikeClient = {
    user: delegate(), roleChange: delegate(), product: delegate(), order: delegate(), orderItem: delegate(), returnRequest: delegate(), productVariant: delegate(), coupon: delegate(), category: delegate(), review: delegate(), wishlistItem: delegate(), address: delegate(), siteSettings: delegate(),
    $transaction: async (operation) => operation(db),
  };
  scope.prisma = db;
  return db;
}
function orderRow(status = "PENDING"): Parameters<typeof toAdminOrder>[0] {
  return { id: "row-1", orderNumber: "LL-TEST-1", status, paymentStatus: "PENDING", paymentMethod: "BKASH", paymentRef: null, subtotal: 100, shipping: 0, discount: 0, giftWrap: 0, total: 100, shippingName: "Test", shippingEmail: "test@example.com", shippingPhone: "01700000000", shippingAddress: "Shiromoni", shippingCity: "Khulna", shippingZip: "9204", shippingCountry: "Bangladesh", notes: null, trackingNumber: null, createdAt: new Date("2026-10-16T12:00:00Z"), items: [] };
}
const input: CreateOrderInput = {
  contact: { name: "Guest test", email: "guest@example.com", phone: "01700000000" },
  shipping: { address: "Shiromoni", city: "Khulna", zip: "9204", country: "Bangladesh", method: "standard", giftWrap: false },
  payment: { method: "COD" },
  items: [{ productId: "test-product", name: "Test product", color: "Gold", size: "M", quantity: 1, price: 100 }],
};

test("admin query has no status/date/limit exclusions and explicitly requests newest first", async () => {
  const db = database();
  db.order.findMany = async (args) => {
    assert.deepEqual((args as { orderBy: unknown }).orderBy, [{ createdAt: "desc" }, { id: "asc" }]);
    assert.ok(!("where" in (args as object)));
    assert.ok(!("take" in (args as object)));
    return ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].map((s) => orderRow(s));
  };
  assert.deepEqual((await getAdminOrders())?.map((r) => r.status), ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]);
});

test("configured admin database errors are explicit, not demo data", async () => {
  const db = database();
  db.order.findMany = async () => { throw new Error("Test database offline"); };
  await assert.rejects(getAdminOrders(), /Could not load live orders/);
});

test("configured but unavailable Prisma cannot masquerade as demo", async () => {
  process.env.DATABASE_URL = "postgresql://test-not-real";
  scope.prismaUnavailable = true;
  await assert.rejects(getAdminOrders(), /unavailable/);
  await assert.rejects(createOrder(input, { name: "Test", email: "test@example.com" }), /Database client unavailable/);
});

test("strict write helper propagates query failure without executing mock fallback", async () => {
  database();
  let fallbackCalled = false;
  await assert.rejects(withDatabase(async () => { throw new Error("write failed"); }, () => { fallbackCalled = true; return 1; }, { fallbackOnError: false }), /write failed/);
  assert.equal(fallbackCalled, false);
});

test("guest checkout creates real user FK and retains atomic stock transaction", async () => {
  const db = database();
  let stockUpdated = false;
  db.user.upsert = async (args) => {
    const data = args as { where: { email: string }; update: object; create: { password: string; role: string } };
    assert.equal(data.where.email, "guest@example.com");
    assert.deepEqual(data.update, {});
    assert.match(data.create.password, /^\$2[aby]\$/);
    assert.equal(data.create.role, "CUSTOMER");
    return { id: "real-guest-id" };
  };
  db.product.findUnique = async () => ({ id: "test-product", name: "Test", variants: [] });
  db.product.updateMany = async () => { stockUpdated = true; return { count: 1 }; };
  db.order.create = async (args) => {
    const data = (args as { data: { userId: string; status: string } }).data;
    assert.equal(data.userId, "real-guest-id");
    assert.equal(data.status, "CONFIRMED"); // Preserve the existing COD contract.
    assert.ok(stockUpdated);
    return { id: "persisted-order" };
  };
  const result = await createOrder(input, { name: "Guest", email: " Guest@Example.com " });
  assert.equal(result.source, "database");
  assert.equal(result.order.id, "persisted-order");
});

test("wallet checkout persists PENDING for an authenticated user", async () => {
  const db = database();
  db.product.findUnique = async () => ({ id: "test-product", name: "Test", variants: [] });
  db.product.updateMany = async () => ({ count: 1 });
  db.order.create = async (args) => {
    const data = (args as { data: { userId: string; status: string } }).data;
    assert.equal(data.userId, "real-user");
    assert.equal(data.status, "PENDING");
    return { id: "wallet-order" };
  };
  const result = await createOrder({ ...input, payment: { method: "BKASH" } }, { id: "real-user", name: "Test", email: "test@example.com" });
  assert.equal(result.order.status, "PENDING");
});

test("insufficient inventory fails checkout instead of reporting mock success", async () => {
  const db = database();
  db.product.findUnique = async () => ({ id: "test-product", name: "Test", variants: [] });
  db.product.updateMany = async () => ({ count: 0 });
  await assert.rejects(createOrder(input, { id: "real-user", name: "Test", email: "test@example.com" }), /Not enough stock/);
});

test("explicit no-database demo mode is preserved", async () => {
  delete process.env.DATABASE_URL;
  assert.equal(await getAdminOrders(), null);
  const result = await createOrder(input, { name: "Test", email: "test@example.com" });
  assert.equal(result.source, "mock");
});
