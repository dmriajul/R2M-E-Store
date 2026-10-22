/** Run only against an isolated demo: this creates an account and one mock order. */
import assert from "node:assert/strict";
import { fixtureVerificationToken } from "./fixture-verification";
import { fixtureToken } from "./turnstile-http-token";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
let checks = 0;
class Client {
  private cookies = new Map<string, string>();
  async request(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    headers.set("cookie", [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "));
    const response = await fetch(new URL(path, base), {
      ...options,
      headers,
      redirect: "manual",
    });
    for (const entry of response.headers.getSetCookie()) {
      const [cookie] = entry.split(";");
      const index = cookie!.indexOf("=");
      const key = cookie!.slice(0, index);
      const value = cookie!.slice(index + 1);
      if (/max-age=0/i.test(entry) || !value) this.cookies.delete(key);
      else this.cookies.set(key, value);
    }
    return response;
  }
  async status(path: string, expected: number, options: RequestInit = {}) {
    const response = await this.request(path, options);
    assert.equal(
      response.status,
      expected,
      `${path}: expected ${expected}, got ${response.status}`,
    );
    checks++;
    return response;
  }
  async csrf() {
    const response = await this.status("/api/auth/csrf", 200);
    return ((await response.json()) as { csrfToken: string }).csrfToken;
  }
  async login(email: string, password: string, valid: boolean | "unverified" = true) {
    const csrfToken = await this.csrf();
    const response = await this.request("/api/auth/callback/credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
      body: new URLSearchParams({
        email,
        password,
        turnstileToken: fixtureToken("login"),
        csrfToken,
        callbackUrl: new URL("/dashboard", base).href,
      }),
    });
    const payload = (await response.json()) as { url: string };
    assert.equal(
      new URL(payload.url).searchParams.get("error"),
      valid === true ? null : "CredentialsSignin",
    );
    if (valid !== true) assert.equal(new URL(payload.url).searchParams.get("code"), valid === "unverified" ? "email-not-verified" : "invalid-credentials");
    checks++;
    return payload;
  }
}

async function main() {
  const guest = new Client();
  const healthResponse = await guest.status("/api/health", 200);
  const healthText = await healthResponse.text();
  assert.equal(process.env.TEST_DATABASE_ADAPTER, "isolated", "External test fixture required");
  assert.equal(JSON.parse(healthText).data.mode, "live", "Configured database path required");
  for (const path of [
    "/",
    "/shop",
    "/cart",
    "/login",
    "/register",
    "/checkout",
    "/about",
    "/contact",
    "/size-guide",
    "/privacy",
    "/terms",
    "/returns",
    "/shipping",
    "/faq",
    "/auth/verify-email-pending",
    "/auth/verification-success",
    "/auth/verification-error",
  ])
    await guest.status(path, 200);
  const collections = await guest.status("/collections", 200);
  // Collections is a real catalogue page: the header always renders, whatever
  // the database holds.
  assert.ok((await collections.text()).includes("Collections"));
  checks++;
  await guest.status("/missing-audit-page", 404);
  for (const path of ["/dashboard", "/dashboard/orders", "/admin"]) {
    const response = await guest.status(path, 307);
    assert.equal(new URL(response.headers.get("location")!, base).pathname, "/login");
  }
  await guest.status("/api/orders?email=sarah@example.com", 401);
  await guest.status("/api/orders", 401, { method: "POST", body: "{}" });
  await guest.status("/api/returns", 401);
  await guest.status("/api/admin/products", 401);
  await guest.status("/api/admin/returns", 401);
  await guest.status("/api/admin/upload", 401, { method: "POST" });
  await guest.status("/api/products?placement=invalid", 400);
  await guest.status("/api/auth/register", 400, {
    method: "POST",
    body: "not-json",
  });
  await guest.status("/api/auth/register", 422, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ turnstileToken: fixtureToken("register") }),
  });

  const customer = new Client();
  const email = `audit-${crypto.randomUUID()}@example.com`;
  const password = "AuditChosenPass123!";
  const registration = JSON.stringify({
    name: "Audit Shopper",
    email,
    password,
    phone: "01700000000",
    role: "SUPER_ADMIN",
  });
  const created = await customer.status("/api/auth/register", 201, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...JSON.parse(registration), turnstileToken: fixtureToken("register") }),
  });
  const account = (await created.json()) as {
    data: { role: string; password?: string; redirectTo: string; emailVerified: null };
  };
  assert.equal(account.data.role, "CUSTOMER");
  assert.equal(account.data.password, undefined);
  assert.equal(account.data.redirectTo, "/auth/verify-email-pending");
  assert.equal(account.data.emailVerified, null);
  assert.equal("token" in account.data, false);
  const registrationSession = await customer.status("/api/auth/session", 200);
  assert.deepEqual(
    await registrationSession.json(),
    null,
    "Registration must not automatically sign in",
  );
  for (const path of ["/api/auth/verify-email", "/api/auth/verify-email?token=invalid"]) {
    const response = await customer.status(path, 303);
    assert.equal(
      new URL(response.headers.get("location")!, base).pathname,
      "/auth/verification-error",
    );
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
  await customer.status("/api/auth/register", 409, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...JSON.parse(registration), turnstileToken: fixtureToken("register") }),
  });
  const wrong = await customer.login(email, "wrong-password", false);
  const unknown = await customer.login("nonexistent-audit@example.com", "password123", false);
  assert.equal(new URL(wrong.url).search, new URL(unknown.url).search);
  await customer.login(email, password, "unverified");
  assert.equal(await (await customer.request("/api/auth/session")).json(), null);
  const token = await fixtureVerificationToken(email);
  const verification = await customer.status(`/api/auth/verify-email?token=${token}`, 303);
  assert.equal(new URL(verification.headers.get("location")!, base).pathname, "/auth/verification-success");
  await customer.login(email, password);
  // A subsequent request with only the HttpOnly cookie simulates a full page reload.
  const sessionResponse = await customer.status("/api/auth/session", 200);
  const session = (await sessionResponse.json()) as {
    user: { email: string; role: string; id: string; emailVerified: boolean };
    expires: string;
  };
  assert.equal(session.user.email, email);
  assert.equal(session.user.role, "CUSTOMER");
  assert.equal(session.user.emailVerified, true);
  assert.ok(Date.parse(session.expires) > Date.now() + 28 * 86400000);
  assert.ok(sessionResponse.headers.get("set-cookie")?.includes("HttpOnly"));
  assert.ok(sessionResponse.headers.get("set-cookie")?.includes("SameSite=Lax"));
  await customer.status("/dashboard", 200);
  const denied = await customer.status("/admin", 302);
  assert.equal(new URL(denied.headers.get("location")!, base).pathname, "/dashboard");
  await customer.status("/api/admin/products", 403);
  await customer.status("/api/orders", 400, {
    method: "POST",
    body: "not-json",
  });
  await customer.status("/api/orders", 422, { method: "POST", body: "{}" });

  const catalogue = await guest.status("/api/products", 200);
  const products = (
    (await catalogue.json()) as {
      data: Array<{
        id: string;
        name: string;
        price: number;
        colors: string[];
        sizes: string[];
        stock: number;
        variants?: Array<{ color: string; size: string; stock: number }>;
      }>;
    }
  ).data;
  const product = products.find(
    (entry) =>
      entry.variants?.some((variant) => variant.stock > 0) ||
      (!entry.variants?.length && entry.stock > 0),
  );
  assert.ok(product);
  await guest.status(`/product/${product.id}`, 200);
  const variant = product.variants?.find((entry) => entry.stock > 0);
  const line = {
    productId: product.id,
    name: "Tampered name",
    price: 0.01,
    color: variant?.color ?? product.colors[0],
    size: variant?.size ?? product.sizes[0],
    quantity: 1,
  };
  const orderInput = {
    items: [line],
    contact: {
      name: "Audit Shopper",
      email: "gift-recipient@example.com",
      phone: "01700000000",
    },
    shipping: {
      address: "Audit Road 1, Shiromoni",
      city: "Khulna",
      state: "Khulna Division",
      zip: "9204",
      country: "Bangladesh",
      method: "standard",
      giftWrap: false,
      saveAddress: true,
    },
    payment: { method: "COD" },
  };
  await customer.status("/api/orders", 409, {
    method: "POST",
    body: JSON.stringify({
      ...orderInput,
      items: [{ ...line, productId: "not-a-product" }],
    }),
  });
  const placed = await customer.status("/api/orders", 201, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderInput),
  });
  const order = (
    (await placed.json()) as {
      data: {
        id: string;
        items: Array<{ price: number; name: string }>;
        shipping: number;
      };
    }
  ).data;
  assert.equal(order.items[0]!.price, product.price);
  assert.equal(order.items[0]!.name, product.name);
  const ordersResponse = await customer.status("/api/orders", 200);
  const orders = (await ordersResponse.json()) as {
    data: Array<{ id: string }>;
  };
  assert.ok(
    orders.data.some((entry) => entry.id === order.id),
    "Owner must see order even when recipient email differs",
  );
  await customer.status(`/dashboard/orders/${order.id}`, 200);

  const admin = new Client();
  await admin.login("admin@mukra.com", "password123");
  await admin.status("/admin", 200);
  await admin.status("/admin/staff", 200);
  await admin.status("/dashboard", 200);
  await admin.status("/api/admin/products", 200);
  const adminOrders = await admin.status("/api/orders", 200);
  assert.equal(
    ((await adminOrders.json()) as { data: Array<{ id: string }> }).data.some(
      (entry) => entry.id === order.id,
    ),
    false,
  );

  const csrfToken = await customer.csrf();
  await customer.request("/api/auth/signout", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({
      csrfToken,
      callbackUrl: new URL("/", base).href,
    }),
  });
  const signedOut = await customer.status("/api/auth/session", 200);
  assert.deepEqual(await signedOut.json(), null);
  await customer.status("/dashboard", 307);
  await customer.status("/api/orders", 401);
  process.stdout.write(
    `PASS: ${checks} HTTP checks. Real Auth.js cookies/JWT/RBAC; external test-only database contract adapter. No live Supabase, stock, or email-delivery claim.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : "HTTP customer-journey check failed");
  process.exitCode = 1;
});
