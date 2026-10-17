"use server";

import { verifyTurnstileToken } from "@/lib/turnstile";
import { TURNSTILE_ERROR } from "@/lib/turnstile-shared";
import { headers } from "next/headers";
import { z } from "zod";
import { prepareVerificationResend } from "@/lib/email-verification";
import { queueVerificationEmail } from "@/lib/emails/queue-verification-email";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const inputSchema = z.object({ email: z.string().trim().email().max(254), turnstileToken: z.unknown().optional() });
const ipLimiter = createRateLimiter({ max: 20, windowMs: 60 * 60 * 1000 });
const genericMessage =
  "If this account needs verification, a new link will be sent. Please check your inbox and spam folder. Resends are limited to three per hour.";

export async function resendVerificationEmail(
  input: unknown,
): Promise<{ ok: boolean; message: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a valid email address." };
  const rate = ipLimiter.check(clientIp(await headers()));
  if (!rate.ok) return { ok: false, message: "Too many requests. Please try again later." };
  if (!await verifyTurnstileToken(parsed.data.turnstileToken, { action: "resend_verification" })) {
    return { ok: false, message: TURNSTILE_ERROR };
  }
  try {
    const recipient = await prepareVerificationResend(parsed.data.email);
    if (recipient) queueVerificationEmail(recipient);
    // Never disclose account existence, verification status, or per-email limit state.
    return { ok: true, message: genericMessage };
  } catch {
    console.error("[verification] Resend storage unavailable");
    return {
      ok: false,
      message: "Verification is temporarily unavailable. Please try again later.",
    };
  }
}
