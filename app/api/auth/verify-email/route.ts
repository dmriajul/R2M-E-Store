import { NextResponse, type NextRequest } from "next/server";
import { verifyEmailToken } from "@/lib/email-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  let verified = false;
  try {
    const tokens = request.nextUrl.searchParams.getAll("token");
    if (tokens.length === 1) verified = await verifyEmailToken(tokens[0] ?? "");
  } catch {
    console.error("[verification] Verification storage unavailable");
  }
  const response = NextResponse.redirect(
    new URL(verified ? "/auth/verification-success" : "/auth/verification-error", request.url),
    303,
  );
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
