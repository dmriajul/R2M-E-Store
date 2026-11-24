/** Google OAuth identity-resolution contract. Uses the Prisma contract double. */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installTestDatabase, type TestFixture } from "./support/test-database";
import {
  resolveGoogleIdentity,
  GOOGLE_PROVIDER_ID,
  type GoogleIdentityInput,
} from "../lib/data/google-oauth";
import type { PrismaLikeClient } from "../lib/prisma";

const env = { ...process.env };
const scope = globalThis as typeof globalThis & {
  prisma?: PrismaLikeClient;
  prismaUnavailable?: boolean;
};
afterEach(() => {
  delete scope.prisma;
  delete scope.prismaUnavailable;
  process.env = { ...env };
});

const baseInput = (overrides: Partial<GoogleIdentityInput> = {}): GoogleIdentityInput => ({
  providerAccountId: "google-sub-1",
  email: "shopper@example.com",
  emailVerified: true,
  name: "Shopper",
  image: "https://example.com/pic.png",
  ...overrides,
});

/** Seed a live local user (no Google identity) — e.g. a Credentials-only account. */
async function seedUser(
  db: PrismaLikeClient,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string } & Record<string, unknown>> {
  return (await db.user.create({
    data: {
      name: "Existing",
      email: "existing@example.com",
      phone: null,
      password: "$2b$10$abcdefghijklmnopqrstuv",
      role: "CUSTOMER",
      avatar: null,
      emailVerified: null,
      ...overrides,
    },
  })) as { id: string } & Record<string, unknown>;
}

test("Google rejects an unverified email claim (never creates or links)", async () => {
  installTestDatabase();
  const result = await resolveGoogleIdentity(baseInput({ emailVerified: false }));
  assert.deepEqual(result, { ok: false, errorType: "OAuthSignInError" });
});

test("Google rejects a missing provider account id or email", async () => {
  installTestDatabase();
  assert.deepEqual(
    await resolveGoogleIdentity(baseInput({ providerAccountId: "" })),
    { ok: false, errorType: "OAuthSignInError" },
  );
  assert.deepEqual(
    await resolveGoogleIdentity(baseInput({ email: "" })),
    { ok: false, errorType: "OAuthSignInError" },
  );
});

test("an existing Google identity signs in its linked user — identity-first, not email", async () => {
  const fixture: TestFixture = installTestDatabase();
  const db = fixture.db;
  const user = await seedUser(db, { email: "linked@example.com" });
  await db.googleIdentity.create({
    data: {
      provider: GOOGLE_PROVIDER_ID,
      providerAccountId: "google-sub-1",
      userId: user.id,
      email: "linked@example.com",
      emailVerified: true,
      name: null,
      image: null,
    },
  });

  // A different email in the profile must NOT matter: the provider account id
  // is the source of truth, so the linked user signs in regardless.
  const result = await resolveGoogleIdentity(baseInput({ email: "someone-else@example.com" }));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.user.id, user.id);
    assert.equal(result.user.email, "linked@example.com");
    assert.equal(result.user.role, "CUSTOMER");
  }
  // No second user was created.
  assert.equal(fixture.rows("user").length, 1);
});

test("an identity pointing at a soft-deleted account is refused, never reactivated", async () => {
  const fixture: TestFixture = installTestDatabase();
  const db = fixture.db;
  const user = await seedUser(db, { email: "deleted@example.com", deletedAt: new Date() });
  await db.googleIdentity.create({
    data: {
      provider: GOOGLE_PROVIDER_ID,
      providerAccountId: "google-sub-1",
      userId: user.id,
      email: "deleted@example.com",
      emailVerified: true,
      name: null,
      image: null,
    },
  });

  const result = await resolveGoogleIdentity(baseInput());
  assert.deepEqual(result, { ok: false, errorType: "OAuthAccountNotLinked" });
});

test("an email already owned by a live user is never auto-linked", async () => {
  const fixture: TestFixture = installTestDatabase();
  const db = fixture.db;
  await seedUser(db, { email: "shopper@example.com" });

  // Same email, different Google account (no prior identity): refuse rather
  // than silently attach the Google identity to the existing account.
  const result = await resolveGoogleIdentity(baseInput({ providerAccountId: "google-sub-other" }));
  assert.deepEqual(result, { ok: false, errorType: "OAuthAccountNotLinked" });
  assert.equal(fixture.rows("googleIdentity").length, 0);
});

test("an email reserved by a soft-deleted account is never reused or linked", async () => {
  const fixture: TestFixture = installTestDatabase();
  const db = fixture.db;
  await seedUser(db, { email: "shopper@example.com", deletedAt: new Date() });

  const result = await resolveGoogleIdentity(baseInput());
  assert.deepEqual(result, { ok: false, errorType: "OAuthAccountNotLinked" });
  assert.equal(fixture.rows("googleIdentity").length, 0);
});

test("a new Google account creates a CUSTOMER with a verified email, a hashed random password, and an identity row", async () => {
  const fixture: TestFixture = installTestDatabase();

  const result = await resolveGoogleIdentity(baseInput());
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.user.email, "shopper@example.com");
  assert.equal(result.user.role, "CUSTOMER");
  assert.ok(result.user.emailVerified instanceof Date);

  const rows = fixture.rows("user");
  assert.equal(rows.length, 1);
  const stored = rows[0]!;
  // Password is a bcrypt hash of a random secret — never the plaintext, never empty.
  assert.match(String(stored.password), /^\$2[aby]\$/);
  assert.notEqual(String(stored.password), "shopper@example.com");
  assert.equal(stored.emailVerified instanceof Date, true);

  const identities = fixture.rows("googleIdentity");
  assert.equal(identities.length, 1);
  assert.equal(identities[0]!.provider, GOOGLE_PROVIDER_ID);
  assert.equal(identities[0]!.providerAccountId, "google-sub-1");
  assert.equal(identities[0]!.userId, result.user.id);
});

test("email is normalized (trimmed, lower-cased) before lookup and creation", async () => {
  const fixture: TestFixture = installTestDatabase();

  const result = await resolveGoogleIdentity(
    baseInput({ email: "  SHOPPER@Example.COM  ", providerAccountId: "  google-sub-2  " }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.user.email, "shopper@example.com");

  const identity = fixture.rows("googleIdentity")[0]!;
  assert.equal(identity.providerAccountId, "google-sub-2");
  assert.equal(identity.email, "shopper@example.com");
});

test("a concurrent sign-in race (P2002) re-resolves once against the committed identity instead of double-creating", async () => {
  const fixture: TestFixture = installTestDatabase();
  const db = fixture.db;
  const input = baseInput({ providerAccountId: "google-sub-race", email: "race@example.com" });

  // Simulate the losing racer: the first $transaction hits a unique violation
  // because a concurrent transaction already committed the user + identity.
  // As a side effect of "the other transaction winning", seed those committed
  // rows, then throw P2002 exactly as the loser's create would.
  let firstTransaction = true;
  const originalTransaction = db.$transaction;
  db.$transaction = (async (operation: Parameters<typeof db.$transaction>[0]) => {
    if (firstTransaction) {
      firstTransaction = false;
      const winner = (await db.user.create({
        data: {
          name: "Race Winner",
          email: "race@example.com",
          phone: null,
          password: "$2b$10$abcdefghijklmnopqrstuv",
          role: "CUSTOMER",
          avatar: null,
          emailVerified: new Date(),
        },
      })) as { id: string } & Record<string, unknown>;
      await db.googleIdentity.create({
        data: {
          provider: GOOGLE_PROVIDER_ID,
          providerAccountId: "google-sub-race",
          userId: winner.id,
          email: "race@example.com",
          emailVerified: true,
          name: null,
          image: null,
        },
      });
      throw { code: "P2002" };
    }
    return originalTransaction(operation);
  }) as PrismaLikeClient["$transaction"];

  const result = await resolveGoogleIdentity(input);
  assert.equal(result.ok, true);
  if (result.ok) {
    // Re-resolved against the committed identity — the winner's user, not a new one.
    assert.equal(result.user.email, "race@example.com");
  }
  // Exactly one user and one identity, despite the race.
  assert.equal(fixture.rows("user").length, 1);
  assert.equal(fixture.rows("googleIdentity").length, 1);
});
