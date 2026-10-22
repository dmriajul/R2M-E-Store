import { NextResponse, type NextRequest } from "next/server";
import { verifyCredentialsDetailed } from "@/lib/data/users";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { loginSchema } from "@/lib/validations/auth";
import { LOGIN_CODES, type AuthApiFailure, type AuthErrorCode } from "@/lib/auth-messages";
import { normalizeRole } from "@/lib/rbac";
import type { ApiResponse, AuthUser } from "@/types";

export const runtime = "nodejs";
const loginIpLimiter = createRateLimiter({ max: 15, windowMs: 15 * 60 * 1000 });
function failure(code: AuthErrorCode, status: number, retryAfter?: number) {
  return NextResponse.json<AuthApiFailure>({ data: null, error: code, code, success: false }, {
    status, headers: { "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) },
  });
}

/**
 * Base-branch credential preflight API retained. It never creates a session.
 * It enforces the SAME captcha, password verification, lockout and customer
 * verification policy as Credentials. No raw exception or account-hint output.
 * The UI uses Credentials directly, avoiding token reuse/two password checks.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<AuthUser> | AuthApiFailure>> {
  const ip = clientIp(request.headers);
  const rate = loginIpLimiter.check(ip);
  if (!rate.ok) return failure("ACCOUNT_LOCKED", 429, rate.retryAfter);
  let payload: unknown;
  try { payload = await request.json(); } catch { return failure("INVALID_REQUEST", 400); }
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  if (!await verifyTurnstileToken(record.turnstileToken, { action: "login" })) return NextResponse.json({ data: null, success: false, error: "invalid_captcha", code: "SECURITY_CHECK_FAILED" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const parsed = loginSchema.safeParse({ email: record.email, password: record.password, remember: true });
  // Match Credentials: malformed/missing/wrong credentials all use generic copy.
  if (!parsed.success) return failure("INVALID_CREDENTIALS", 401);
  try {
    const { user, failure: reason } = await verifyCredentialsDetailed(parsed.data.email, parsed.data.password, { ip });
    if (!user) {
      const code = reason ? LOGIN_CODES[reason] : "INVALID_CREDENTIALS";
      return failure(code, code === "ACCOUNT_LOCKED" ? 429 : 401);
    }
    if (normalizeRole(user.role) === "CUSTOMER" && !user.emailVerified) return failure("EMAIL_NOT_VERIFIED", 403);
    return NextResponse.json({ data: user, error: null, code: null, success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[auth:security] Credential storage unavailable");
    return failure("SERVER_ERROR", 503);
  }
}
