"use server";

import { extractTurnstileToken, verifyTurnstileToken } from "@/lib/turnstile";
import { TURNSTILE_ERROR, TURNSTILE_RESPONSE_FIELD } from "@/lib/turnstile-shared";
import { headers } from "next/headers";
import { z } from "zod";
import { prepareVerificationResend } from "@/lib/email-verification";
import { queueVerificationEmail } from "@/lib/emails/queue-verification-email";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const inputSchema = z.object({
  email: z.string().trim().email().max(254),
  [TURNSTILE_RESPONSE_FIELD]: z.unknown().optional(),
  turnstileToken: z.unknown().optional(),
});
const ipLimiter = createRateLimiter({ max: 20, windowMs: 60 * 60 * 1000 });
const genericMessage =
  "If this account needs verification, a new link will be sent. Please check your inbox and spam folder. Resends are limited to three per hour.";

export async function resendVerificationEmail(
  input: unknown,
): Promise<{ ok: boolean; message: string }> {
  const normalizedInput = input instanceof FormData
    ? {
        email: input.get("email"),
        [TURNSTILE_RESPONSE_FIELD]: input.get(TURNSTILE_RESPONSE_FIELD) ?? undefined,
        turnstileToken: input.get("turnstileToken") ?? undefined,
      }
    : input;
  const parsed = inputSchema.safeParse(normalizedInput);
  if (!parsed.success) return { ok: false, message: "Enter a valid email address." };
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const rate = ipLimiter.check(ip);
  if (!rate.ok) return { ok: false, message: "Too many requests. Please try again later." };
  const token = extractTurnstileToken(parsed.data, requestHeaders);
  if (!await verifyTurnstileToken(token, { action: "resend_verification", remoteIp: ip, requestHeaders })) {
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
