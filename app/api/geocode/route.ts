import { type NextRequest, NextResponse } from "next/server";
import { searchLocations, reverseLocation } from "@/lib/geocoding";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const limiter = createRateLimiter({ max: 30, windowMs: 60_000 });

export async function GET(request: NextRequest) {
  const limit = limiter.check(clientIp(request.headers));
  if (!limit.ok) return NextResponse.json({ error: "Too many searches. Please wait a minute.", data: [] }, { status: 429, headers: { "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" } });
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const reverse = request.nextUrl.searchParams.has("lng") && request.nextUrl.searchParams.has("lat");
  if (reverse ? (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < 88 || lng > 93 || lat < 20 || lat > 27) : (query.length < 2 || query.length > 160)) {
    return NextResponse.json({ error: "Enter a Bangladesh location or four-digit postal code.", data: [] }, { status: 400 });
  }
  const data = reverse ? await reverseLocation(lng, lat) : await searchLocations(query);
  return NextResponse.json({ data, error: data.length ? null : "Location not found. Please try postal code or manual entry." }, { headers: { "Cache-Control": "no-store" } });
}
