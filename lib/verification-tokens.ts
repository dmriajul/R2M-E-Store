import { createHash, randomBytes } from "node:crypto";

export const VERIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const RESEND_WINDOW_MS = 60 * 60 * 1000;
export const MAX_VERIFICATION_RESENDS = 3;

export interface VerificationTokenRecord {
  id: string;
  identifier: string;
  /** SHA-256 of the emailed token. The raw bearer secret is never stored. */
  token: string;
  expires: Date;
  resendCount: number;
  resendWindowStart: Date;
}

export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newVerificationToken(email: string, now = new Date()) {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    record: {
      identifier: email.trim().toLowerCase(),
      token: hashVerificationToken(token),
      expires: new Date(now.getTime() + VERIFICATION_LIFETIME_MS),
      resendCount: 0,
      resendWindowStart: now,
    },
  };
}

export type NewVerificationTokenRecord = ReturnType<typeof newVerificationToken>["record"];
