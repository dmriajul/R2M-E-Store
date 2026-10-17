# Bangladesh postal directory

`bangladesh-postal-codes.json` contains **1,346 unique postal-code records**, 318,554 bytes (about 311 KiB), served only through the server geocoding endpoint. It is not imported into the browser bundle. No synthetic codes were added to reach a target count.

## Sources and licensing

Retrieved 2026-10-16; generator inputs are pinned to these revisions:

- Postal names/codes: [TanjidulIslamToha/bangladesh-postal-codes-database](https://github.com/TanjidulIslamToha/bangladesh-postal-codes-database/tree/a0c000d35def7fefa84a59484c63e556edcfb667), `postcodes-pretty.json`. MIT, copyright 2025 Tanjidul Islam Toha; see `postal-LICENSE.txt`. This is a community dataset, **not an independently audited Bangladesh Post Office feed**. Its README documents its upstream Wikipedia/district-range sources.
- District-centre coordinates: [nuhil/bangladesh-geocode](https://github.com/nuhil/bangladesh-geocode/tree/5622f68bd07a98e076edcf8100bf0db6a75b9854), `districts/districts.json`. MIT, copyright 2014 Nuhil Mehdy; see `nuhil-LICENSE.txt`. That repository supplies administrative geography, not a complete geolocated postal-office directory.
- **9204 locality coordinates**: [Who's On First locality 1293821317](https://github.com/whosonfirst-data/whosonfirst-data-admin-bd/blob/c6c88a155fe0215a778e4a80118a9a3d4a5c7071/data/129/382/131/7/1293821317.geojson), derived from **GeoNames 7486172, Siramani**, longitude 89.50622, latitude 22.91597. See `whosonfirst-LICENSE.md` and [GeoNames attribution/license information](https://www.geonames.org/about.html). These are locality-centre coordinates, not a verified post-office building or doorstep. The UI includes attribution links.

## Data quality and intentional differences

- Upstream has 1,347 entries. **3893 is excluded** pending authoritative review: its English district is Noakhali, but its Bengali district is Sunamganj, division Sylhet, thana Chhatak. Do not silently map this contradictory row to a delivery location.
- English district spelling is normalized to the existing checkout select options (e.g. Cumilla → Comilla, Chapai Nawabganj → Chapainawabganj).
- 9204 is called **Siramani / শিরোমনি** in the postal source, with thana **Khulna Sadar**. Its display area is normalized to **Shiromoni**, retaining Siramani, Siromoni and Bengali aliases. Shiromoni is an area, not a replacement administrative thana in this source.
- All records include `code`, `district`, `division`, `thana`, `area`, `areaBn`, `aliases`, `latitude`, `longitude`, and `coordinateAccuracy`.
- **1,345 records use district-centre approximations**, explicitly tagged `coordinateAccuracy: "district"` and visibly labelled in the picker, with a zoomed-out marker and a request to drag it to the actual delivery spot. They are not claimed to be rural/post-office coordinates.
- **9204 uses sourced locality coordinates**, tagged `coordinateAccuracy: "locality"`.
- Coordinates should be progressively enriched from licensed, verified local sources. Preserve their accuracy/provenance rather than guessing per-office points.

## Regeneration

```sh
npm run data:postal
npm run test:location-orders
```

The generator downloads three pinned inputs from the GitHub API, validates the size/count guard, applies the documented exclusion/normalizations, and overwrites the JSON deterministically. GitHub API availability/rate limits apply. In the Arena sandbox, Node may need the supplied CA certificate:

```sh
NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/e2b-ca.crt npm run data:postal
```

Do not disable TLS verification. The CA path above is sandbox-specific, not a deployment setting.
