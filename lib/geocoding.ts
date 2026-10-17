import { createRateLimiter } from "@/lib/rate-limit";
import postalCodes from "@/lib/data/bangladesh-postal-codes.json";
import { BANGLADESH_DIVISIONS } from "@/lib/bangladesh-locations";

export interface LocationAddress {
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode?: string;
}

export interface LocationSuggestion {
  id: string;
  placeName: string;
  center: [number, number];
  address: LocationAddress;
  source: "postal" | "mapbox" | "locationiq";
  approximate?: boolean;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  text: string;
  address?: string;
  center: [number, number];
  relevance?: number;
  context?: Array<{ id: string; text: string }>;
}

interface LocationIQFeature {
  place_id: string | number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    country_code?: string;
    state?: string;
    state_district?: string;
    county?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    road?: string;
    postcode?: string;
  };
}

const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const aliases: Record<string, string> = {
  chattogram: "Chittagong", cumilla: "Comilla", barishal: "Barisal",
  jessore: "Jashore", bogra: "Bogura", jhalakathi: "Jhalokati",
  chapainawabganj: "Chapainawabganj", netrakona: "Netrokona",
};

/** Match provider spellings to checkout select values, without defaulting to Dhaka. */
export function canonicalDistrict(value: string): string {
  const key = normalize(value.replace(/\s+(district|division)$/i, ""));
  return aliases[key] ?? BANGLADESH_DIVISIONS.flatMap((d) => d.districts.map((district) => ({ name: String(district.name) })))
    .find((d) => normalize(d.name) === key)?.name ?? value;
}

function addressWithDivision(address: LocationAddress): LocationAddress {
  const city = canonicalDistrict(address.city);
  const division = BANGLADESH_DIVISIONS.find((d) => d.districts.some((item) => item.name === city));
  return { ...address, city, state: division?.name ?? address.state };
}

function postalSuggestion(row: (typeof postalCodes)[number]): LocationSuggestion {
  return {
    id: `postal-${row.code}`,
    placeName: `${row.area}, ${row.thana}, ${row.district} ${row.code}`,
    center: [row.longitude, row.latitude],
    address: addressWithDivision({ address1: row.area, address2: row.thana, city: row.district, state: row.division, postalCode: row.code }),
    source: "postal",
    approximate: row.coordinateAccuracy === "district",
  };
}

export function lookupPostalLocations(query: string): LocationSuggestion[] {
  const key = normalize(query);
  if (/^\d{4}$/.test(query)) return postalCodes.filter((row) => row.code === query).map(postalSuggestion);
  if (key.length < 3) return [];
  return postalCodes.filter((row) => [row.area, row.areaBn, ...row.aliases]
    .some((name) => normalize(name) === key)).slice(0, 5).map(postalSuggestion);
}

function mapboxSuggestion(feature: MapboxFeature): LocationSuggestion {
  const context = [ { id: feature.id, text: feature.text }, ...(feature.context ?? []) ];
  const get = (prefix: string) => context.find((item) => item.id.startsWith(prefix))?.text;
  return {
    id: feature.id, placeName: feature.place_name, center: feature.center, source: "mapbox",
    address: addressWithDivision({
      address1: [feature.address, feature.text].filter(Boolean).join(" "),
      address2: get("locality") ?? get("neighborhood"),
      city: get("district") ?? get("place") ?? "",
      state: get("region"), postalCode: get("postcode"),
    }),
  };
}

function iqSuggestion(feature: LocationIQFeature): LocationSuggestion {
  const a = feature.address ?? {};
  return {
    id: `iq-${feature.place_id}`, placeName: feature.display_name,
    center: [Number(feature.lon), Number(feature.lat)], source: "locationiq",
    address: addressWithDivision({
      address1: a.village ?? a.suburb ?? a.road ?? a.town ?? feature.display_name.split(",")[0] ?? "",
      address2: a.county ?? a.town,
      city: a.state_district ?? a.city ?? a.county ?? "",
      state: a.state, postalCode: a.postcode,
    }),
  };
}

function inBangladesh(center: [number, number]): boolean {
  return Number.isFinite(center[0]) && Number.isFinite(center[1]) && center[0] >= 88 && center[0] <= 93 && center[1] >= 20 && center[1] <= 27;
}

async function requestJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error("Geocoding provider unavailable");
  return response.json() as Promise<T>;
}

async function mapbox(query: string, reverse: boolean): Promise<MapboxFeature[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return [];
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.search = new URLSearchParams({ access_token: token, country: "bd", limit: reverse ? "1" : "5", ...(reverse ? {} : { autocomplete: "true" }) }).toString();
  const data = await requestJson<{ features?: MapboxFeature[] }>(url);
  return (data.features ?? []).filter((f) => Array.isArray(f.center) && inBangladesh(f.center));
}

// Per-instance safeguards, not a distributed account quota. Configure provider
// limits or a shared Redis limiter when deploying multiple server instances.
const iqDaily = createRateLimiter({ max: 4500, windowMs: 86_400_000 });
const iqBurst = createRateLimiter({ max: 2, windowMs: 1000 });

async function locationIQ(query: string, reverse: boolean): Promise<LocationSuggestion[]> {
  const key = process.env.LOCATIONIQ_API_KEY;
  if (!key || !iqBurst.check("locationiq").ok || !iqDaily.check("locationiq").ok) return [];
  const url = new URL(`https://us1.locationiq.com/v1/${reverse ? "reverse" : "search"}`);
  const [lng = "", lat = ""] = query.split(",");
  url.search = new URLSearchParams({ key, format: "json", addressdetails: "1", ...(reverse ? { lat, lon: lng } : { q: query, countrycodes: "bd", limit: "5" }) }).toString();
  const data = await requestJson<LocationIQFeature[] | LocationIQFeature>(url);
  return (Array.isArray(data) ? data : [data]).filter((f) => f.address?.country_code === "bd")
    .map(iqSuggestion).filter((f) => inBangladesh(f.center));
}

/** Mapbox remains primary; relevance and lexical matching prevent unrelated city matches. */
export async function searchLocations(query: string): Promise<LocationSuggestion[]> {
  const local = lookupPostalLocations(query);
  // Unknown four-digit codes must never be interpreted as street numbers.
  if (/^\d{4}$/.test(query)) return local;
  const features = await mapbox(query, false).catch(() => []);
  const key = normalize(query);
  const confident = features.filter((f) => (f.relevance ?? 0) >= 0.7 && normalize(f.place_name).includes(key));
  const fallback = confident.length ? [] : await locationIQ(query, false).catch(() => []);
  // Exact local area aliases outrank provider approximations; additional
  // provider matches remain selectable in the suggestions dropdown.
  const precise = [...confident.map(mapboxSuggestion), ...fallback];
  return [...local, ...precise].filter((item, index, all) => all.findIndex((other) => other.placeName === item.placeName) === index).slice(0, 7);
}

export async function reverseLocation(lng: number, lat: number): Promise<LocationSuggestion[]> {
  const features = await mapbox(`${lng},${lat}`, true).catch(() => []);
  if (features.length) return features.map(mapboxSuggestion);
  return locationIQ(`${lng},${lat}`, true).catch(() => []);
}
