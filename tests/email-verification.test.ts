import assert from "node:assert/strict";
import { installTestDatabase } from "./support/test-database";
import { afterEach, test } from "node:test";
import { createUser, findUserByEmail, getUserEmailVerificationStatus } from "../lib/data/users";
import { prepareVerificationResend, verifyEmailToken } from "../lib/email-verification";
import {
  hashVerificationToken,
  newVerificationToken,
  RESEND_WINDOW_MS,
  VERIFICATION_LIFETIME_MS,
  type VerificationTokenRecord,
} from "../lib/verification-tokens";
import {
  buildVerificationEmail,
  sendVerificationEmail,
  verificationEmailLink,
} from "../lib/emails/send-verification-email";
import { authConfig } from "../lib/auth.config";
import type { PrismaDelegate, PrismaLikeClient } from "../lib/prisma";

const env = { ...process.env };
const originalFetch = globalThis.fetch;
const scope = globalThis as typeof globalThis & {
  prisma?: PrismaLikeClient;
  prismaUnavailable?: boolean;
};
afterEach(() => {
  for (const key of [
    "DATABASE_URL",
    "NEXTAUTH_URL",
    "AUTH_URL",
    "NODE_ENV",
    "ALLOW_DEMO_MODE",
    "DEBUG_VERIFICATION_EMAILS",
    "MAILJET_API_KEY",
    "MAILJET_SECRET_KEY",
    "MAILJET_SENDER_EMAIL",
  ]) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  globalThis.fetch = originalFetch;
  delete scope.prisma;
  delete scope.prismaUnavailable;
});

function delegate(overrides: Partial<PrismaDelegate> = {}): PrismaDelegate {
  const unexpected = async (): Promise<never> => {
    throw new Error("Unexpected DB operation");
  };
  return {
    findMany: unexpected,
    findUnique: unexpected,
    findFirst: unexpected,
    create: unexpected,
    update: unexpected,
    upsert: unexpected,
    delete: unexpected,
    updateMany: unexpected,
    deleteMany: unexpected,
    count: unexpected,
    ...overrides,
  };
}
function database(overrides: Partial<PrismaLikeClient>): PrismaLikeClient {
  const db: PrismaLikeClient = {
    user: delegate(),
    verificationToken: delegate(),
    roleChange: delegate(),
    product: delegate(),
    order: delegate(),
    orderItem: delegate(),
    returnRequest: delegate(),
    productVariant: delegate(),
    coupon: delegate(),
    category: delegate(),
    review: delegate(),
    wishlistItem: delegate(),
    address: delegate(),
    siteSettings: delegate(),
    $transaction: async (operation) => operation(db),
    ...overrides,
  };
  process.env.DATABASE_URL = "postgresql://test.invalid/verification";
  scope.prisma = db;
  return db;
}
async function fixtureCustomer(now = new Date()) {
  const fixture = installTestDatabase();
  const email = `verify-${crypto.randomUUID()}@example.com`;
  const issued = newVerificationToken(email, now);
  const result = await createUser(
    { name: "Verification Test", email, password: "ChosenSecret123!" },
    issued.record,
  );
  assert.ok(result.user);
  return { email, user: result.user, fixture, ...issued };
}

test("256-bit random tokens have 24h expiry, normalized email and only a digest at rest", () => {
  const now = new Date("2026-10-16T00:00:00Z");
  const first = newVerificationToken(" USER@EXAMPLE.COM ", now);
  const second = newVerificationToken("user@example.com", now);
  assert.match(first.token, /^[a-f0-9]{64}$/);
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.record.token, first.token);
  assert.equal(first.record.token, hashVerificationToken(first.token));
  assert.equal(first.record.identifier, "user@example.com");
  assert.equal(first.record.expires.getTime() - now.getTime(), VERIFICATION_LIFETIME_MS);
});

test("new customer remains unverified until the single-use token is consumed", async () => {
  const customer = await fixtureCustomer();
  assert.equal((await findUserByEmail(customer.email))?.emailVerified, null);
  assert.equal(customer.fixture.rows("verificationToken").find((row) => row.identifier === customer.email)?.token, customer.record.token);
  assert.equal(await verifyEmailToken(customer.token), true);
  assert.ok((await findUserByEmail(customer.email))?.emailVerified instanceof Date);
  assert.equal(await getUserEmailVerificationStatus(customer.user.id), true);
  assert.equal(customer.fixture.rows("verificationToken").some((row) => row.identifier === customer.email), false);
  assert.equal(await verifyEmailToken(customer.token), false);
});

test("missing, malformed, unknown, and expired tokens cannot verify an account", async () => {
  const now = new Date();
  const customer = await fixtureCustomer(new Date(now.getTime() - VERIFICATION_LIFETIME_MS));
  assert.equal(await verifyEmailToken(customer.token, now), false);
  for (const token of ["", "short", "z".repeat(64), "<script>", "a".repeat(64)])
    assert.equal(await verifyEmailToken(token, now), false);
  assert.equal((await findUserByEmail(customer.email))?.emailVerified, null);
});

test("resend rotates links, permits only 3/hour, and resets after an hour", async () => {
  const now = new Date();
  const customer = await fixtureCustomer(now);
  const first = await prepareVerificationResend(customer.email.toUpperCase(), now);
  assert.ok(first);
  assert.equal(await verifyEmailToken(customer.token, now), false);
  const second = await prepareVerificationResend(customer.email, now);
  const third = await prepareVerificationResend(customer.email, now);
  assert.ok(second && third);
  assert.equal(await verifyEmailToken(first.token, now), false);
  assert.equal(await prepareVerificationResend(customer.email, now), null);
  const nextHour = new Date(now.getTime() + RESEND_WINDOW_MS + 1);
  const next = await prepareVerificationResend(customer.email, nextHour);
  assert.ok(next);
  assert.equal(await verifyEmailToken(third.token, nextHour), false);
  assert.equal(await verifyEmailToken(next.token, nextHour), true);
});

test("verified and unknown accounts return the same resend result without issuing a token", async () => {
  const customer = await fixtureCustomer();
  await verifyEmailToken(customer.token);
  assert.equal(await prepareVerificationResend(customer.email), null);
  assert.equal(await prepareVerificationResend("absent@example.com"), null);
  assert.equal(customer.fixture.rows("verificationToken").some((row) => row.identifier === customer.email), false);
});

test("registration inserts user and token in one database transaction", async () => {
  let transactions = 0;
  let stored: unknown;
  const issued = newVerificationToken("atomic@example.com");
  const db = database({
    user: delegate({
      findFirst: async () => null,
      create: async () => ({
        id: "u",
        email: "atomic@example.com",
        name: "Atomic",
        role: "CUSTOMER",
        password: "redacted",
      }),
    }),
    verificationToken: delegate({
      upsert: async (args) => {
        stored = args;
        return {};
      },
    }),
  });
  db.$transaction = async (operation) => {
    transactions++;
    return operation(db);
  };
  const result = await createUser(
    { name: "Atomic Test", email: "atomic@example.com", password: "ChosenSecret123!" },
    issued.record,
  );
  assert.ok(result.user);
  assert.equal(transactions, 1);
  assert.deepEqual(stored, {
    where: { identifier: "atomic@example.com" },
    create: issued.record,
    update: issued.record,
  });
});

test("registration token storage failure propagates instead of fabricating success", async () => {
  let failedTransaction = false;
  const db = database({
    user: delegate({
      findFirst: async () => null,
      create: async () => ({
        id: "u",
        name: "Test",
        email: "failed@example.com",
        role: "CUSTOMER",
        password: "redacted",
      }),
    }),
    verificationToken: delegate({
      upsert: async () => {
        throw new Error("token storage unavailable");
      },
    }),
  });
  db.$transaction = async (operation) => {
    try {
      return await operation(db);
    } catch (error) {
      failedTransaction = true;
      throw error;
    }
  };
  await assert.rejects(
    () =>
      createUser(
        { name: "Test User", email: "failed@example.com", password: "ChosenSecret123!" },
        newVerificationToken("failed@example.com").record,
      ),
    /token storage unavailable/,
  );
  assert.equal(failedTransaction, true);
});

test("database verification queries digest, conditionally consumes it and updates only its owner", async () => {
  const issued = newVerificationToken("owner@example.com");
  const row: VerificationTokenRecord = { id: "token-id", ...issued.record };
  let lookup: unknown;
  let consume: unknown;
  let update: unknown;
  let transactions = 0;
  const now = new Date();
  const db = database({
    verificationToken: delegate({
      findUnique: async (args) => {
        lookup = args;
        return row;
      },
      deleteMany: async (args) => {
        consume = args;
        return { count: 1 };
      },
    }),
    user: delegate({
      updateMany: async (args) => {
        update = args;
        return { count: 1 };
      },
    }),
  });
  db.$transaction = async (operation) => {
    transactions++;
    return operation(db);
  };
  assert.equal(await verifyEmailToken(issued.token, now), true);
  assert.equal(transactions, 1);
  assert.deepEqual(lookup, { where: { token: issued.record.token } });
  assert.deepEqual(consume, { where: { id: row.id, token: row.token, expires: { gt: now } } });
  assert.deepEqual(update, {
    where: { email: { equals: "owner@example.com", mode: "insensitive" }, deletedAt: null },
    data: { emailVerified: now },
  });
});

test("a concurrently consumed database token cannot update the user twice", async () => {
  const issued = newVerificationToken("owner@example.com");
  let updated = false;
  database({
    verificationToken: delegate({
      findUnique: async () => ({ id: "t", ...issued.record }),
      deleteMany: async () => ({ count: 0 }),
    }),
    user: delegate({
      updateMany: async () => {
        updated = true;
        return { count: 1 };
      },
    }),
  });
  assert.equal(await verifyEmailToken(issued.token), false);
  assert.equal(updated, false);
});

test("a deleted/missing owner throws inside transaction so consumption can roll back", async () => {
  const issued = newVerificationToken("owner@example.com");
  let rolledBack = false;
  const db = database({
    verificationToken: delegate({
      findUnique: async () => ({ id: "t", ...issued.record }),
      deleteMany: async () => ({ count: 1 }),
    }),
    user: delegate({ updateMany: async () => ({ count: 0 }) }),
  });
  db.$transaction = async (operation) => {
    try {
      return await operation(db);
    } catch (error) {
      rolledBack = true;
      throw error;
    }
  };
  assert.equal(await verifyEmailToken(issued.token), false);
  assert.equal(rolledBack, true);
});

test("database resends reserve quota conditionally, rotate the digest, and suppress fourth email", async () => {
  let quota = 0;
  const rotations: Array<Record<string, unknown>> = [];
  database({
    user: delegate({
      findFirst: async () => ({
        id: "u",
        email: "quota@example.com",
        name: "Quota",
        emailVerified: null,
      }),
    }),
    verificationToken: delegate({
      upsert: async () => ({}),
      updateMany: async (args) => {
        const value = args as {
          where: { resendCount?: { lt: number } };
          data: Record<string, unknown>;
        };
        if (!value.where.resendCount) return { count: 0 };
        assert.equal(value.where.resendCount.lt, 3);
        if (quota >= 3) return { count: 0 };
        quota++;
        rotations.push(value.data);
        return { count: 1 };
      },
    }),
  });
  for (let index = 0; index < 3; index++)
    assert.ok(await prepareVerificationResend("quota@example.com"));
  assert.equal(await prepareVerificationResend("quota@example.com"), null);
  assert.equal(rotations.length, 3);
  assert.notEqual(rotations[0]?.token, rotations[1]?.token);
});

test("configured storage failures cannot fall back to demo verification", async () => {
  const customer = await fixtureCustomer();
  database({
    verificationToken: delegate({
      findUnique: async () => {
        throw new Error("DB down");
      },
    }),
  });
  await assert.rejects(() => verifyEmailToken(customer.token), /DB down/);
  assert.equal(customer.fixture.rows("verificationToken").some((row) => row.identifier === customer.email), true);
});

test("premium email contains escaped name, CTA, expiry, fallback URL and disables tracking", () => {
  process.env.NEXTAUTH_URL = "https://mukra.example";
  const token = newVerificationToken("email@example.com").token;
  const email = buildVerificationEmail({
    email: "email@example.com",
    name: '<img src=x onerror="alert(1)">',
    token,
  });
  assert.ok(email.html.includes("Verify My Email"));
  assert.ok(email.html.includes("#d4af37"));
  assert.ok(email.html.includes("24 hours"));
  assert.ok(email.html.includes("&lt;img"));
  assert.equal(email.html.includes("<img src=x"), false);
  assert.ok(email.text.includes(`https://mukra.example/api/auth/verify-email?token=${token}`));
  assert.equal(email.trackClicks, false);
  assert.equal(email.trackOpens, false);
});

test("verification URLs reject credentials, non-HTTP origins and insecure production origins", () => {
  const token = newVerificationToken("test@example.com").token;
  for (const origin of ["javascript:alert(1)", "https://user:secret@example.com"]) {
    process.env.NEXTAUTH_URL = origin;
    assert.throws(() => verificationEmailLink(token));
  }
  Object.assign(process.env, {
    NODE_ENV: "production",
    NEXTAUTH_URL: "http://mukra.example",
    ALLOW_DEMO_MODE: "false",
  });
  assert.throws(() => verificationEmailLink(token));
});

test("Mailjet failures reject delivery but leave the new user/token intact", async () => {
  const customer = await fixtureCustomer();
  Object.assign(process.env, {
    NEXTAUTH_URL: "https://mukra.example",
    MAILJET_API_KEY: "fixture",
    MAILJET_SECRET_KEY: "fixture",
    MAILJET_SENDER_EMAIL: "fixture@mukra.example",
  });
  globalThis.fetch = async () => new Response("", { status: 503 });
  await assert.rejects(() =>
    sendVerificationEmail({ email: customer.email, name: "Test", token: customer.token }),
  );
  assert.ok(await findUserByEmail(customer.email));
  assert.equal(await verifyEmailToken(customer.token), true);
});

test("production never prints bearer links even if local-debug flag is accidentally enabled", async () => {
  Object.assign(process.env, {
    NODE_ENV: "production",
    NEXTAUTH_URL: "https://mukra.example",
    DEBUG_VERIFICATION_EMAILS: "true",
    ALLOW_DEMO_MODE: "false",
  });
  delete process.env.MAILJET_API_KEY;
  delete process.env.MAILJET_SECRET_KEY;
  delete process.env.MAILJET_SENDER_EMAIL;
  let logged = false;
  const warn = console.warn;
  console.warn = () => {
    logged = true;
  };
  try {
    await assert.rejects(() =>
      sendVerificationEmail({
        email: "test@example.com",
        name: "Test",
        token: newVerificationToken("test@example.com").token,
      }),
    );
    assert.equal(logged, false);
  } finally {
    console.warn = warn;
  }
});

test("session verification flag is server-derived and unverified customers remain authorized", async () => {
  const args = {
    token: { id: "u", role: "CUSTOMER", emailVerified: true },
    session: { user: { id: "u", role: "CUSTOMER" }, expires: new Date().toISOString() },
  } as unknown as Parameters<typeof authConfig.callbacks.session>[0];
  assert.equal((await authConfig.callbacks.session(args)).user.emailVerified, true);
  args.token.emailVerified = false;
  assert.equal((await authConfig.callbacks.session(args)).user.emailVerified, false);
  assert.equal(
    await authConfig.callbacks.authorized({
      auth: { user: { id: "u", role: "CUSTOMER", emailVerified: false } },
      request: { nextUrl: new URL("https://mukra.example/dashboard") },
    } as Parameters<typeof authConfig.callbacks.authorized>[0]),
    true,
  );
});

test("Mailjet receives branded multipart content with tracking disabled and validates message status", async () => {
  Object.assign(process.env, {
    NEXTAUTH_URL: "https://mukra.example",
    MAILJET_API_KEY: "fixture",
    MAILJET_SECRET_KEY: "fixture",
    MAILJET_SENDER_EMAIL: "fixture@mukra.example",
  });
  let content:
    | {
        Messages: Array<{
          HTMLPart: string;
          TextPart: string;
          TrackClicks: string;
          TrackOpens: string;
        }>;
      }
    | undefined;
  globalThis.fetch = async (_input, options) => {
    content = JSON.parse(String(options?.body)) as typeof content;
    return Response.json({ Messages: [{ Status: "success" }] });
  };
  const recipient = {
    email: "test@example.com",
    name: "Test",
    token: newVerificationToken("test@example.com").token,
  };
  await sendVerificationEmail(recipient);
  assert.ok(content?.Messages[0]?.HTMLPart.includes("Verify My Email"));
  assert.ok(content?.Messages[0]?.TextPart.includes("24 hours"));
  assert.equal(content?.Messages[0]?.TrackClicks, "disabled");
  assert.equal(content?.Messages[0]?.TrackOpens, "disabled");
  globalThis.fetch = async () => Response.json({ Messages: [{ Status: "error" }] });
  await assert.rejects(() => sendVerificationEmail(recipient), /acceptance/);
});
