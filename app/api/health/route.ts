import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

interface HealthPayload {
  status: "ok";
  service: string;
  timestamp: string;
}

/** Liveness probe — also proves the App Router API segment is wired up. */
export function GET() {
  const payload: ApiResponse<HealthPayload> = {
    data: {
      status: "ok",
      service: "luxe-storefront",
      timestamp: new Date().toISOString(),
    },
    error: null,
    success: true,
  };

  return NextResponse.json(payload, { status: 200 });
}
