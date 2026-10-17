import { requireDatabase } from "@/lib/prisma";
import {
  hashVerificationToken,
  MAX_VERIFICATION_RESENDS,
  newVerificationToken,
  RESEND_WINDOW_MS,
  type VerificationTokenRecord,
} from "@/lib/verification-tokens";

export interface VerificationRecipient {
  email: string;
  name: string;
  token: string;
}

interface VerificationUser {
  id: string;
  name: string;
  email: string;
  emailVerified: Date | null;
}

class InvalidVerificationToken extends Error {}

/** Returns null for unknown, verified, deleted, or rate-limited accounts alike. */
export async function prepareVerificationResend(
  email: string,
  now = new Date(),
): Promise<VerificationRecipient | null> {
  const identifier = email.trim().toLowerCase();
  const issued = newVerificationToken(identifier, now);
  const cutoff = new Date(now.getTime() - RESEND_WINDOW_MS);
  return requireDatabase<VerificationRecipient | null>(
    (db) =>
      db.$transaction(async (tx) => {
        const user = (await tx.user.findFirst({
          where: { email: { equals: identifier, mode: "insensitive" }, deletedAt: null },
          select: { id: true, name: true, email: true, emailVerified: true },
        })) as VerificationUser | null;
        if (!user || user.emailVerified) return null;

        // One row per identifier. Row locks from upsert/conditional updates serialize
        // concurrent resends, including across independent serverless instances.
        await tx.verificationToken.upsert({
          where: { identifier },
          create: issued.record,
          update: {},
        });
        await tx.verificationToken.updateMany({
          where: { identifier, resendWindowStart: { lte: cutoff } },
          data: { resendCount: 0, resendWindowStart: now },
        });
        const reserved = await tx.verificationToken.updateMany({
          where: { identifier, resendCount: { lt: MAX_VERIFICATION_RESENDS } },
          data: {
            token: issued.record.token,
            expires: issued.record.expires,
            resendCount: { increment: 1 },
          },
        });
        return reserved.count === 1
          ? { email: user.email, name: user.name, token: issued.token }
          : null;
      }),
  );
}

/** Atomically consumes a valid bearer token and verifies only its owning account. */
export async function verifyEmailToken(token: string, now = new Date()): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const digest = hashVerificationToken(token);
  try {
    return await requireDatabase<boolean>(
      (db) =>
        db.$transaction(async (tx) => {
          const record = (await tx.verificationToken.findUnique({
            where: { token: digest },
          })) as VerificationTokenRecord | null;
          if (!record || record.expires <= now) return false;
          const consumed = await tx.verificationToken.deleteMany({
            where: { id: record.id, token: digest, expires: { gt: now } },
          });
          if (consumed.count !== 1) return false;
          const updated = await tx.user.updateMany({
            where: { email: { equals: record.identifier, mode: "insensitive" }, deletedAt: null },
            data: { emailVerified: now },
          });
          // Throw to roll the token deletion back if no live owner exists.
          if (updated.count !== 1) throw new InvalidVerificationToken();
          return true;
        }),
    );
  } catch (error) {
    if (error instanceof InvalidVerificationToken) return false;
    throw error; // Configured storage failures must not become demo success.
  }
}
