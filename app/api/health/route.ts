import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/config";
import type { ApiResponse } from "@/types";

interface HealthPayload {
  status: "ok";
  service: string;
  /** ISO timestamp of the check. */
  checkedAt: string;
  /** Configuration only, not connectivity. Use /api/ready for an actual query probe. */
  mode: "unconfigured" | "live";
  integrations: ReturnType<typeof integrationStatus>;
}

/** Liveness/configuration only; /api/ready performs bounded auth schema queries. */
export function GET() {
  const integrations = integrationStatus();

  const payload: ApiResponse<HealthPayload> = {
    data: {
      status: "ok",
      service: "mukra-storefront",
      checkedAt: new Date().toISOString(),
      mode: integrations.database === "configured" ? "live" : "unconfigured",
      integrations,
    },
    error: null,
    success: true,
  };

  return NextResponse.json(payload, { status: 200 });
}
