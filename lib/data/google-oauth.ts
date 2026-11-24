/**
 * Google OAuth identity resolution — the durable, secure link between a Google
 * account and a local Prisma `User`.
 *
 * Security rules enforced here (and only here):
 *  - Google's `email_verified` claim must be `true`. An unverified profile never
 *    creates or links an account.
 *  - An existing `GoogleIdentity` row always signs in its linked user — the
 *    provider account id is the source of truth, never the email.
 *  - An email that already belongs to a local user (live **or** soft-deleted)
 *    is never auto-linked. Soft-deleted accounts are never reactivated; their
 *    email stays reserved by `User.email @unique`, so a new account cannot be
 *    created with it either.
 *  - New Google accounts are created with the `CUSTOMER` role and a
 *    cryptographically secure random password (bcrypt-hashed). The plaintext
 *    random secret is never stored or logged.
 *  - Duplicate creation (concurrent sign-ins racing on the same email or
 *    provider account id) is resolved by retrying the lookup once against the
 *    committed row instead of failing or double-creating.
 */

import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { requireDatabase } from "@/lib/prisma";
import { BCRYPT_ROUNDS } from "@/lib/data/users";
import type { AuthUser } from "@/types";

export const GOOGLE_PROVIDER_ID = "google";

export interface GoogleIdentityInput {
  /** Stable provider account id — Google's `sub` claim. */
  providerAccountId: string;
  /** Email as reported by Google (normalized here). */
  email: string;
  /** Google's `email_verified` claim — must be `true`. */
  emailVerified: boolean;
  name?: string | null;
  image?: string | null;
}

export type GoogleResolutionError = "OAuthAccountNotLinked" | "OAuthSignInError";

export type GoogleResolution =
  | { ok: true; user: AuthUser }
  | { ok: false; errorType: GoogleResolutionError };

/** Normalizes an email the same way the credentials flow does. */
const normalise = (email: string): string => email.trim().toLowerCase();

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  avatar: string | null;
  emailVerified: Date | null;
}

function isP2002(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    role: row.role as AuthUser["role"],
    avatar: row.avatar ?? undefined,
    emailVerified: row.emailVerified,
  };
}

/**
 * Resolves a Google profile to a local user, creating the account + identity
 * row atomically when the Google account has never signed in before.
 *
 * Never throws for expected rejection cases — returns a typed error so the
 * Auth.js `signIn` callback can map it to a fixed public message.
 */
export async function resolveGoogleIdentity(
  input: GoogleIdentityInput,
  depth = 0,
): Promise<GoogleResolution> {
  const providerAccountId = input.providerAccountId.trim();
  const email = normalise(input.email);

  // Google must have verified the email; a missing id or address can never
  // produce a session.
  if (!input.emailVerified || !providerAccountId || !email) {
    return { ok: false, errorType: "OAuthSignInError" };
  }

  try {
    return await requireDatabase(async (db) => {
      // 1. Existing identity for this provider account? Sign in its user.
      const identity = (await db.googleIdentity.findFirst({
        where: { provider: GOOGLE_PROVIDER_ID, providerAccountId },
        select: { userId: true },
      })) as { userId: string } | null;

      if (identity) {
        const user = (await db.user.findFirst({
          where: { id: identity.userId, deletedAt: null },
          select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, emailVerified: true },
        })) as UserRow | null;
        // The identity points at a missing or soft-deleted account: refuse
        // rather than reactivate it.
        if (!user) return { ok: false, errorType: "OAuthAccountNotLinked" as const };
        return { ok: true, user: toAuthUser(user) };
      }

      // 2. The email is already taken — by a live account or by a soft-deleted
      //    one whose address is still reserved by the unique constraint.
      //    Never auto-link an unlinked account by email match.
      const emailOwner = (await db.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, deletedAt: true },
      })) as { id: string; deletedAt: Date | null } | null;
      if (emailOwner) {
        return { ok: false, errorType: "OAuthAccountNotLinked" as const };
      }

      // 3. New Google account: create the local user and the identity row in
      //    one transaction. The password is a cryptographically secure random
      //    secret, bcrypt-hashed — the plaintext is never stored or logged.
      const passwordHash = await hash(randomBytes(32).toString("base64url"), BCRYPT_ROUNDS);
      const created = (await db.$transaction(async (tx) => {
        const user = (await tx.user.create({
          data: {
            name: input.name?.trim() || email.split("@")[0],
            email,
            phone: null,
            password: passwordHash,
            role: "CUSTOMER",
            avatar: input.image ?? null,
            // Google verified the email — mark it so the customer can sign in
            // without a separate verification round-trip.
            emailVerified: new Date(),
          },
          select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, emailVerified: true },
        })) as UserRow;
        await tx.googleIdentity.create({
          data: {
            provider: GOOGLE_PROVIDER_ID,
            providerAccountId,
            userId: user.id,
            email,
            emailVerified: true,
            name: input.name ?? null,
            image: input.image ?? null,
          },
        });
        return user;
      })) as UserRow;

      return { ok: true, user: toAuthUser(created) };
    });
  } catch (error) {
    // A concurrent sign-in won the race (unique email or identity row).
    // Re-resolve once against the committed state: the identity now exists
    // (sign in its user) or the email is now taken (reject) — never
    // double-create or fabricate success.
    if (isP2002(error) && depth < 1) {
      return resolveGoogleIdentity(input, depth + 1);
    }
    throw error;
  }
}
