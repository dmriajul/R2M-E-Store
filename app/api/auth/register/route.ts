import { NextResponse, type NextRequest } from "next/server";
import { createUser } from "@/lib/data/users";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import {
  AUTH_ERROR_CODES,
  validateRegistrationServerInput,
} from "@/lib/validations/auth";
import type { ApiResponse, AuthUser } from "@/types";

export const runtime = "nodejs";

const registerLimiter = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });

/**
 * Registers a customer account.
 *
 * Sanitizes inputs, validates email format and password strength, hashes the
 * password with bcrypt, and returns specific error codes (`EMAIL_ALREADY_EXISTS`,
 * `INVALID_EMAIL`, `WEAK_PASSWORD`, `PASSWORD_MISMATCH`, `MISSING_FIELDS`,
 * `SERVER_ERROR`) that the client maps to user-friendly messages.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<AuthUser & { source: string }>>> {
  const ip = clientIp(request.headers);
  const rate = registerLimiter.check(ip);

  if (!rate.ok) {
    console.warn("[auth:security] Registration rate limit exceeded:", {
      ip,
      retryAfter: rate.retryAfter,
    });
    return NextResponse.json(
      {
        data: null,
        error: AUTH_ERROR_CODES.RATE_LIMITED,
        code: AUTH_ERROR_CODES.RATE_LIMITED,
        success: false,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfter) },
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

  const validation = validateRegistrationServerInput(payload);
  if (!validation.ok) {
    const status = validation.code === AUTH_ERROR_CODES.MISSING_FIELDS ? 400 : 422;
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
    const { user, code, source } = await createUser({
      name: validation.data.name,
      email: validation.data.email,
      phone: validation.data.phone,
      password: validation.data.password,
    });

    if (!user) {
      const failureCode = code ?? AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS;
      return NextResponse.json(
        {
          data: null,
          error: failureCode,
          code: failureCode,
          field: failureCode === AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS ? "email" : undefined,
          success: false,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        data: { ...user, source },
        error: null,
        code: null,
        success: true,
        source,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[auth:security] Registration error:", error);
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
