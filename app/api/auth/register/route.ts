import { NextResponse, type NextRequest } from "next/server";
import { createRateLimiter, clientIp } from "@/lib/rate-limit";
import { queueVerificationEmail } from "@/lib/emails/queue-verification-email";
import { newVerificationToken } from "@/lib/verification-tokens";
import { createUser } from "@/lib/data/users";
import { verifyTurnstileToken } from "@/lib/turnstile";
import type { AuthApiFailure, AuthErrorCode, AuthField } from "@/lib/auth-messages";
import { authValidationErrors } from "@/lib/validations/auth";
import { registerApiSchema } from "@/lib/validations";
import type { ApiResponse, AuthUser } from "@/types";

export const runtime = "nodejs";
const limiter = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });

/**
 * Registers a customer.
 *
 * Zod validates the payload, bcrypt hashes the password, Prisma stores the row
 * and its verification token in a transaction. No configured database means 503,
 * never an in-memory account or a success-looking response.
 */
function failure(code: AuthErrorCode, status: number, fieldErrors?: Partial<Record<AuthField, AuthErrorCode>>, headers?: HeadersInit) {
  return NextResponse.json<AuthApiFailure>({ data: null, success: false, error: code, code, ...(fieldErrors ? { fieldErrors } : {}) }, { status, headers });
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<AuthUser & { source: string; redirectTo: string }> | AuthApiFailure>> {
  const rate = limiter.check(clientIp(request.headers));
  if (!rate.ok) return failure("ACCOUNT_LOCKED", 429, undefined, { "Retry-After": String(rate.retryAfter) });
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return failure("INVALID_REQUEST", 400);
  }

  const parsed = registerApiSchema.safeParse(payload);
  if (!parsed.success) {
    const result = authValidationErrors(parsed.error);
    return failure(result.code, 422, result.fieldErrors);
  }
  const token = payload && typeof payload === "object" && "turnstileToken" in payload ? payload.turnstileToken : undefined;
  if (!await verifyTurnstileToken(token, { action: "register" })) return NextResponse.json({ data: null, success: false, error: "invalid_captcha", code: "SECURITY_CHECK_FAILED" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  try {
    const issued = newVerificationToken(parsed.data.email);
    const { user, source } = await createUser(
      {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        password: parsed.data.password,
      },
      issued.record,
    );

    if (!user) return failure("EMAIL_ALREADY_EXISTS", 409, { email: "EMAIL_ALREADY_EXISTS" });

    queueVerificationEmail({ email: user.email, name: user.name, token: issued.token });

    return NextResponse.json(
      {
        data: { ...user, source, redirectTo: "/auth/verify-email-pending" },
        error: null,
        success: true,
        source,
      },
      { status: 201 },
    );
  } catch {
    console.error("[registration] Account storage unavailable");
    return failure("SERVER_ERROR", 503);
  }
}
