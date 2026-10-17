import { NextResponse } from "next/server";
import { requireDatabase } from "@/lib/prisma";
import { isTurnstileServerConfigured } from "@/lib/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Readiness, not liveness. No credentials, connection details, PII or query errors leave this endpoint. */
export async function GET() {
  let database = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      requireDatabase(async (db) => {
        // Probe columns used by auth and the additive verification schema, not just client initialization.
        await db.user.findFirst({ select: { id: true, password: true, emailVerified: true, deletedAt: true } });
        await db.verificationToken.findFirst({ select: { id: true, resendCount: true, resendWindowStart: true } });
      }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Readiness timeout")), 5_000); }),
    ]);
    database = true;
  } catch { /* Health consumers receive only a fixed status, never raw errors. */ }
  finally { clearTimeout(timer); }
  const turnstile = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()) && isTurnstileServerConfigured();
  const auth = Boolean(process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim());
  const ready = database && turnstile && auth;
  return NextResponse.json({ status: ready ? "ready" : "unavailable", checks: {
    database: database ? "ready" : "unavailable", turnstile: turnstile ? "configured" : "missing", auth: auth ? "configured" : "missing",
  } }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store, must-revalidate" } });
}
