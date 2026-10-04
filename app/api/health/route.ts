import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/config";
import type { ApiResponse } from "@/types";

interface HealthPayload {
  status: "ok";
  service: string;
  /** ISO timestamp of the check. */
  checkedAt: string;
  /** "demo" when nothing is configured, "live" once DATABASE_URL is set. */
  mode: "demo" | "live";
  integrations: ReturnType<typeof integrationStatus>;
}

/**
 * Liveness + integration probe.
 *
 * The storefront runs on mock data when nothing is configured, so this endpoint
 * reports *what is wired up* instead of failing — add DATABASE_URL and `mode`
 * flips to "live" without a code change.
 */
export function GET() {
  const integrations = integrationStatus();

  const payload: ApiResponse<HealthPayload> = {
    data: {
      status: "ok",
      service: "luxe-storefront",
      checkedAt: new Date().toISOString(),
      mode: integrations.demoMode ? "demo" : "live",
      integrations,
    },
    error: null,
    success: true,
  };

  return NextResponse.json(payload, { status: 200 });
}
