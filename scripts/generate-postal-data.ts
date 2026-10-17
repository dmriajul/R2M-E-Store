import { writeFile } from "node:fs/promises";

// Pinned inputs make generated data changes reviewable and reproducible.
const POSTAL = "TanjidulIslamToha/bangladesh-postal-codes-database";
const GEO = "nuhil/bangladesh-geocode";
const WOF = "whosonfirst-data/whosonfirst-data-admin-bd";
async function github<T>(repo: string, ref: string, path: string): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${ref}`, {
    headers: { Accept: "application/vnd.github.raw+json" },
  });
  if (!response.ok) throw new Error(`${repo}/${path}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function main() {
  const [postcodes, districts, siramani] = await Promise.all([
    github<Record<string, { en: { district: string; division: string; thana: string; suboffice: string }; bn: { suboffice: string } }>>(POSTAL, "a0c000d35def7fefa84a59484c63e556edcfb667", "postcodes-pretty.json"),
    github<Array<{ data?: Array<{ name: string; lat: string; lon: string }> }>>(GEO, "5622f68bd07a98e076edcf8100bf0db6a75b9854", "districts/districts.json"),
    github<{ geometry: { coordinates: [number, number] } }>(WOF, "c6c88a155fe0215a778e4a80118a9a3d4a5c7071", "data/129/382/131/7/1293821317.geojson"),
  ]);
  const aliases: Record<string, string> = { Cumilla: "Comilla", Chittagong: "Chattogram", "Cox's Bazar": "Coxsbazar", "Chapai Nawabganj": "Chapainawabganj", Jhalokati: "Jhalakathi" };
  const canonical: Record<string, string> = { Cumilla: "Comilla", "Chapai Nawabganj": "Chapainawabganj" };
  const rows = Object.entries(postcodes)
    // Upstream 3893 contradicts itself: English Noakhali vs Bengali Sunamganj
    // and Sylhet/Chhatak. Quarantine it pending an authoritative correction.
    .filter(([code]) => code !== "3893").sort(([a], [b]) => a.localeCompare(b)).map(([code, { en, bn }]) => {
    const district = districts.flatMap((table) => table.data ?? []).find((d) => d.name === (aliases[en.district] ?? en.district));
    if (!district || !/^\d{4}$/.test(code)) throw new Error(`Invalid/missing district for ${code}`);
    return {
      code, district: canonical[en.district] ?? en.district, division: `${en.division} Division`,
      thana: en.thana, area: code === "9204" ? "Shiromoni" : en.suboffice, areaBn: bn.suboffice,
      aliases: code === "9204" ? ["Siramani", "Siromoni", "শিরোমনি", "শিরোমণি"] : [],
      latitude: code === "9204" ? siramani.geometry.coordinates[1] : Number(district.lat),
      longitude: code === "9204" ? siramani.geometry.coordinates[0] : Number(district.lon),
      coordinateAccuracy: code === "9204" ? "locality" : "district",
    };
  });
  const json = `${JSON.stringify(rows)}\n`;
  if (rows.length < 1000 || Buffer.byteLength(json) >= 2_000_000) throw new Error("Dataset size guard failed");
  await writeFile("lib/data/bangladesh-postal-codes.json", json);
}

void main();
