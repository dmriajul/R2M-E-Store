import { NextResponse, type NextRequest } from "next/server";
import { isAccountLocked, verifyCredentialsDetailed } from "@/lib/data/users";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import {
  AUTH_ERROR_CODES,
  sanitizeEmail,
  validateLoginServerInput,
} from "@/lib/validations/auth";
import type { ApiResponse, AuthUser } from "@/types";

export const runtime = "nodejs";

const loginIpLimiter = createRateLimiter({ max: 15, windowMs: 15 * 60 * 1000 });

/**
 * Validates login credentials and returns machine-readable error codes
 * (`INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_LOCKED`,
 * `MISSING_FIELDS`, `INVALID_EMAIL`, `SERVER_ERROR`) that the client maps to
 * user-friendly messages.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<AuthUser>>> {
  const ip = clientIp(request.headers);
  const ipRate = loginIpLimiter.check(ip);

  if (!ipRate.ok) {
    console.warn("[auth:security] Login IP rate limit exceeded:", {
      ip,
      retryAfter: ipRate.retryAfter,
    });
    return NextResponse.json(
      {
        data: null,
        error: AUTH_ERROR_CODES.ACCOUNT_LOCKED,
        code: AUTH_ERROR_CODES.ACCOUNT_LOCKED,
        success: false,
      },
      {
        status: 429,
        headers: { "Retry-After": String(ipRate.retryAfter) },
      },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: AUTH_ERROR_CODES.MISSING_FIELDS,
        code: AUTH_ERROR_CODES.MISSING_FIELDS,
        success: false,
      },
      { status: 400 },
    );
  }

  const candidateEmail =
    payload && typeof payload === "object"
      ? sanitizeEmail((payload as Record<string, unknown>).email)
      : "";

  if (candidateEmail && isAccountLocked(candidateEmail, ip)) {
    return NextResponse.json(
      {
        data: null,
        error: AUTH_ERROR_CODES.ACCOUNT_LOCKED,
        code: AUTH_ERROR_CODES.ACCOUNT_LOCKED,
        success: false,
      },
      { status: 429 },
    );
  }

  const validation = validateLoginServerInput(payload);
  if (!validation.ok) {
    const status =
      validation.code === AUTH_ERROR_CODES.MISSING_FIELDS
        ? 400
        : validation.code === AUTH_ERROR_CODES.INVALID_EMAIL
          ? 422
          : 401;
    return NextResponse.json(
      {
        data: null,
        error: validation.code,
        code: validation.code,
        field: validation.field,
        success: false,
      },
      { status },
    );
  }

  try {
    const { user, failure } = await verifyCredentialsDetailed(
      validation.data.email,
      validation.data.password,
      { ip },
    );

    if (!user) {
      const code = failure ?? AUTH_ERROR_CODES.INVALID_CREDENTIALS;
      const status =
        code === AUTH_ERROR_CODES.ACCOUNT_LOCKED
          ? 429
          : code === AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED
            ? 403
            : code === AUTH_ERROR_CODES.SERVER_ERROR
              ? 500
              : 401;

      return NextResponse.json(
        {
          data: null,
          error: code,
          code,
          field: code === AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED ? "email" : undefined,
          success: false,
        },
        { status },
      );
    }

    return NextResponse.json(
      {
        data: user,
        error: null,
        code: null,
        success: true,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[auth:security] Login route error:", error);
    return NextResponse.json(
      {
        data: null,
        error: AUTH_ERROR_CODES.SERVER_ERROR,
        code: AUTH_ERROR_CODES.SERVER_ERROR,
        success: false,
      },
      { status: 500 },
    );
  }
}
