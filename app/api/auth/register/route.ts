import { NextResponse, type NextRequest } from "next/server";
import { createUser } from "@/lib/data/users";
import { registerApiSchema } from "@/lib/validations";
import type { ApiResponse, AuthUser } from "@/types";

export const runtime = "nodejs";

/**
 * Registers a customer.
 *
 * Zod validates the payload, bcrypt hashes the password, Prisma stores the row
 * — and when no database is configured the same call succeeds against the demo
 * user table so onboarding works end-to-end in demo mode.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<AuthUser & { source: string }>>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Expected a JSON body", success: false },
      { status: 400 },
    );
  }

  const parsed = registerApiSchema.safeParse(payload);
  if (!parsed.success) {
    // Prefix the message with the offending field so the form can show it
    // next to the right input.
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path.join(".") ?? "";
    return NextResponse.json(
      {
        data: null,
        error: firstIssue ? `${field ? `${field}: ` : ""}${firstIssue.message}` : "Invalid details",
        success: false,
      },
      { status: 422 },
    );
  }

  const { user, error, source } = await createUser({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    password: parsed.data.password,
  });

  if (!user) {
    return NextResponse.json(
      { data: null, error: error ?? "Could not create the account", success: false },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      data: { ...user, source },
      error: null,
      success: true,
      source,
    },
    { status: 201 },
  );
}
