# MUKRA: location picker and admin order synchronization

Verification date: **2026-10-16**. Work is on the existing Arena branch.

## Summary

Implemented a server-side Mapbox → LocationIQ geocoder, a local Bangladesh postal directory, a resilient location picker, and authenticated two-second admin order polling. Checkout no longer reports a successful mock order after a configured database write fails.

**Configuration still required in the deployment:** `LOCATIONIQ_API_KEY` (server-only), the existing `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, and a working `DATABASE_URL` / generated Prisma client. There were no live provider/database credentials available for end-to-end verification in this checkout. Sandbox outbound restrictions also prevent live calls to Mapbox, LocationIQ and Supabase. No deployment credentials or customer data were changed.

## Root-cause findings

### Location picker

Confirmed code-level issues:

1. Search used only Mapbox and accepted every returned match without checking relevance or matching the query text. There was no postcode directory or fallback.
2. Selecting a result immediately reverse-geocoded its coordinates with Mapbox. This could overwrite a correct rural/postal selection with a broader/unrelated address.
3. The reverse parser had a ternary/operator-precedence error in its thana extraction and defaulted missing cities to Dhaka.
4. Search requests were not cancelled; stale responses could replace more recent results. Failures were silent.
5. Both Next.js and Vercel headers explicitly disabled geolocation with `geolocation=()`.

Changes:

- `/api/geocode` handles forward/reverse requests on the server; LocationIQ's key never reaches browser code. Mapbox remains primary for text searches. Empty results, HTTP errors, missing relevance or relevance below 0.7 trigger LocationIQ. An unrelated high-relevance result also triggers fallback.
- Four-digit inputs use only the local postal directory. Unknown codes are not treated as street numbers. A unique postal result is automatically selected and fills the existing shipping form fields.
- Exact postal-area names and aliases provide a deterministic rural fallback, including Shiromoni/Siramani/Siromoni and Bengali names. Exact local names outrank provider approximations in the dropdown.
- Selection keeps the selected address instead of reverse-geocoding it again. GPS and manual marker dragging still reverse-geocode, preserving the actual GPS/drag coordinate.
- Added request cancellation, debouncing, keyboard-navigable suggestions, loading/selected/error states, manual-entry guidance, geolocation with timeout/permission-error handling, and gold-theme selection styling.
- Search remains available even if the map fails to load or has no token. Geolocation policy now permits the same origin in both deployment configs.
- Anonymous geocoding is limited to 30 requests/minute/IP per instance. LocationIQ has per-instance burst (2/second) and daily (4,500/day) safeguards. These **do not guarantee an account-wide limit across serverless instances**: use LocationIQ quota controls or a shared Redis limiter for a multi-instance deployment. Verify the free-tier quota in your own LocationIQ account.

### Admin orders

Confirmed code-level issues:

1. The shared `/admin` layout hydrated a Zustand store, but the orders page did not subsequently fetch new orders. Shared layouts persist across client-side navigation. The layout was **already `force-dynamic`**; simply adding that flag again would not update an open dashboard.
2. `getAdminOrders()` returned `null` on database read failure. The hydrator interpreted `null` as demo mode, leaving old demo orders visible and concealing the failure.
3. `createOrder()` used `withDatabase()`, which swallowed database/stock/FK failures and returned a successful in-memory mock order. Such an order does not exist in Postgres and cannot appear in the real admin list.
4. Guest writes used `userId: "demo-guest"`, despite `Order.userId` being a required foreign key. A missing sentinel user caused the transaction to fail and silently fall back to mock success.
5. Date filters, CSV filenames and summary cards used a fixed demo date/static statistics.

Audit findings that were **not** the cause:

- The Prisma admin query already sorts `createdAt DESC`, has no status/date WHERE exclusion and no `take` limit.
- The Order model has no soft-delete flag.
- Existing payment policy deliberately creates **COD as CONFIRMED/UNPAID**, and wallet orders as **PENDING/PENDING**. Both are included in the admin query. This policy was preserved to avoid breaking payment/confirmation behavior; no `draft` state is created.

Changes:

- Added an RBAC-protected, no-store `GET /api/admin/orders`, restricted to `orders:read` roles.
- Orders page fetches immediately and every two seconds while visible, and on focus; refreshes never overlap. Added manual refresh, last-success time, explicit demo mode, timeout and stale-data errors. Identical responses do not reset pagination. Changed initial sort to the date column, descending; filters and stats now use real data/current time.
- Configured database read failures now throw; initial failures clear demo rows, and polling failures preserve the last successful live rows with a visible stale warning.
- Checkout opts into strict database writes. Configured database failures return an error rather than mock success. Guest checkout upserts a real customer FK target inside the stock/order transaction, without changing existing account profiles/passwords. New guest records receive an unpredictable bcrypt-hashed password. Existing atomic stock checks remain intact.
- Successful database checkout revalidates `/admin/orders`, `/admin` and `/dashboard/orders`. Two-second polling handles already-open tabs, independent of router cache invalidation.
- Order creation logs order number, status and source, not customer/address/payment details.

These are confirmed code paths, not a diagnosis of the remote production database. Previously returned `source: "mock"` orders were never committed and cannot be recovered from Postgres by refreshing.

## Postal database

- File: `lib/data/bangladesh-postal-codes.json`
- **1,346 unique real source records**, **318,554 bytes**, under the 2 MB limit; no fabricated padding to 8,000 records.
- The source has 1,347 entries; one contradictory row (3893) is excluded pending verification.
- 9204 resolves **Khulna Division → Khulna → Khulna Sadar (thana) → Shiromoni (area)**, with longitude **89.50622**, latitude **22.91597** from GeoNames / Who's On First.
- **Important correction to the requested acceptance values:** the postal source identifies **Khulna Sadar**, not Shiromoni, as the thana. The existing checkout has `address1` / `address2`, not separate village/thana controls: `address1 = Shiromoni`, `address2 = Khulna Sadar`, `city = Khulna`, `state = Khulna Division`, `postalCode = 9204`.
- Other records currently use **explicitly labelled district-centre approximations** rather than invented post-office coordinates. Users must drag the marker/confirm their manual address. Rural coordinates beyond 9204 still need progressive enrichment.
- Full provenance, exclusions, accuracy limitations, licenses and regeneration instructions: `lib/data/bangladesh-postal-codes.README.md`.

## Verification report

PASS below means the stated automated/HTTP check passed, not that a real device or production integration was exercised.

| Acceptance criterion | Result | Evidence / limitation |
| --- | --- | --- |
| “Shiromoni” returns the correct Khulna area | **PASS (automated + HTTP)** | Alias tests and production-server `GET /api/geocode?q=Shiromoni` resolve 9204/Khulna, never Baridhara. Live map rendering not exercised. |
| 9204 fills Khulna, “Thana: Shiromoni”, and map marker | **PARTIAL / literal thana differs** | Postal lookup, shipping payload and sourced locality coordinate pass tests and HTTP. Source-correct mapping uses **thana Khulna Sadar, area Shiromoni**. Browser auto-fill/map interaction still needs manual validation. |
| LocationIQ fallback when Mapbox fails | **PASS (mock-provider tests)** | Empty results, relevance 0.6 and HTTP 503 cases tested; high-confidence Mapbox remains primary. Actual provider calls need deployed credentials/network. |
| “Use my location” works on mobile | **NOT VERIFIED on device** | Implemented GPS handling, preserved coordinates, permission/timeouts and policy correction. Production HTTP header permits `geolocation=(self)`. Test allow/deny on HTTPS mobile. |
| New orders appear within 5 seconds | **NOT VERIFIED end-to-end** | Two-second no-store polling implemented. Real Supabase write → separate browser observation timing requires a connected DB. A healthy request is expected to meet the target; slow/offline requests cannot be guaranteed. |
| Newest-first sorting | **PASS (query test/code audit)** | Query asserts `createdAt DESC`; displayed rows and initial date sort are descending. |
| All pending/confirmed/processing/shipped/delivered statuses visible | **PASS (data-layer test)** | All five plus cancelled/refunded are returned and mapped; default tab is All; no query exclusion/limit. |
| TypeScript and lint: zero errors | **PASS** | `npx tsc --noEmit`, `npm run lint`; zero errors and zero ESLint warnings. |
| Production build | **PASS** | `npm run build` completed with dynamic admin/API routes. Initial clean build reported existing Auth.js/Jose edge-runtime CompressionStream/DecompressionStream warnings; final incremental build succeeded without warnings. |
| Postal JSON ≥1,000 entries and <2 MB | **PASS** | Automated count, uniqueness, coordinate bounds and checkout district/division compatibility assertions. |
| Regression suite | **PASS** | `npm run test:location-orders`: 20 tests passed. Database operations are test doubles, not a real Prisma/Postgres transaction integration. |
| Admin API privacy and RBAC | **PASS (production HTTP)** | Guest 401; shopper and inventory manager 403; support and super-admin 200. Responses have `no-store`; demo responses explicitly identify their source. |

Additional production HTTP checks passed: 9204 lookup, Shiromoni lookup, unknown postal code returns no result, too-short query 400, coordinates outside Bangladesh 400, `/checkout` 200 with corrected geolocation policy.

## Testing instructions

### Setup

1. Set deployment/local environment values securely (not in Git): `DATABASE_URL`, optional `DIRECT_URL` for your Prisma workflow, existing `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, and new **server-only** `LOCATIONIQ_API_KEY`.
2. Run `npm ci`, then `npx prisma generate`. Apply the project's existing schema/migrations to a **test** database if needed. Do not reseed or reset a production database to test this change.
3. Run:
   ```sh
   npm run test:location-orders
   npx tsc --noEmit
   npm run lint
   npm run build
   npm run start -- --hostname 0.0.0.0
   ```
4. Ensure the deployment can reach Mapbox, LocationIQ and Postgres. Restart/rebuild after changing public Mapbox environment values. Check LocationIQ account quota and key restrictions for **server-side** requests.

### Location picker

1. Add an item to the cart, open `/checkout`, complete contact information and go to Shipping.
2. Search `Shiromoni`; choose the highlighted Khulna result. Verify the marker near **22.91597, 89.50622**, area Shiromoni, address line 2 Khulna Sadar, district Khulna, division Khulna Division.
3. Clear search and type `9204`. After the debounce, the unique postal record should select automatically and fill the same fields plus postal code 9204. No provider request should be made for the four-digit lookup; the browser only requests the same-origin geocoding endpoint.
4. Search `Siramani`, `Siromoni` and `শিরোমনি`; all must resolve the same area. Confirm selecting an area does not trigger a second reverse request that overwrites it.
5. Search a major city/neighborhood and confirm Mapbox results work. Search a rural area where Mapbox gives no/weak match; confirm LocationIQ results appear and their attribution is visible. Browser developer tools cannot directly intercept server-to-provider requests; use the regression tests for deterministic failure simulation or a controlled server-side test environment. Do not invalidate live production keys to simulate failure.
6. Type `9999` or an unfindable name. Expect helpful postal/manual-entry guidance, not an unrelated Dhaka address. Type rapidly and clear the input; stale responses must not reopen obsolete suggestions. Test arrow keys, Enter, Escape and touch selection.
7. Try another valid postal code. Verify the **approximate district-centre** warning is shown; drag the marker to the true spot and verify the updated address before continuing. The district approximation is not a precise delivery coordinate.
8. On a real mobile device over HTTPS, tap **Use my current location**. Grant permission, check the marker and form fields; repeat with permission denied. If inside a cross-origin preview iframe, the parent iframe also needs to allow geolocation: open the app in its own tab if the container blocks permission.
9. Confirm manual entry and checkout continue to work when geocoding/map loading fails. Search and manual entry must still be available without a Mapbox token.

### Orders and synchronization

1. Use a test database with real products/stock. Open `/admin/orders` as support/super-admin in browser A. Choose **All** and **All time**, clear search and stay on page 1. Confirm the page reports **Live orders**, not demo mode; inspect `/api/admin/orders` responses for `source: "database"` and `Cache-Control: private, no-store, must-revalidate`.
2. In browser B (or a private session), place a **guest COD** checkout order. The checkout response must be HTTP 201 with `source: "database"`. Record its order number and response time; confirm that same number appears at the top of browser A within 5 seconds without reloading. COD remains Confirmed/Unpaid by design.
3. Repeat as a signed-in shopper using a wallet payment. Verify Pending/Pending until verified. Check a real `Order` row and related `OrderItem` rows exist, and that the FK is a real user ID, not `demo-guest`.
4. Repeat across two independent browsers/devices so no shared client state can mask synchronization problems. Confirm returning to a backgrounded admin tab triggers a fresh fetch. Click **Refresh orders** and confirm stats, date filters and newest-first ordering reflect live records.
5. Using existing admin status controls, verify Pending, Confirmed, Processing, Shipped and Delivered orders appear in All and their individual tabs. Cancelled/refunded remain visible too. Date filters should use the current date, not the old demo reference.
6. On a disposable test environment, make the DB unavailable or attempt a stock-conflicting order. Checkout must return an error, never a successful mock confirmation. Admin must show an explicit refresh error/stale warning, not substitute demo orders. Restore connectivity and verify polling recovers.
7. With **no `DATABASE_URL`**, confirm demo checkout still works and the admin page explicitly warns that the demo dataset is not a durable/synchronized order backend. This is not a valid environment for the 5-second Postgres-sync acceptance test.
8. Check the new admin orders endpoint as a guest/shopper/inventory role: expect 401/403, not customer order data.

## Files modified / created

### Modified

1. `.env.example` — documents private LocationIQ key.
2. `.env.production.example` — same production setting.
3. `app/admin/layout.tsx` — clear demo orders on configured order-read failure.
4. `app/admin/orders/page.tsx` — polling/refresh UI, live stats/date filters, explicit descending date sort.
5. `app/api/orders/route.ts` — revalidate after durable checkout, safe write-failure response.
6. `components/checkout/MapboxLocationPicker.tsx` — hybrid search UI, postal auto-selection, GPS, cancellation, address preservation and attribution.
7. `components/checkout/StepShipping.tsx` — derive canonical division from district, avoid retaining a previous thana/address line 2.
8. `lib/data/admin-orders.ts` — distinguish configured failures from demo mode.
9. `lib/data/orders.ts` — strict durable writes, real guest FK, operational confirmation logs.
10. `lib/prisma.ts` — opt-in strict query/write error behavior.
11. `next.config.ts` — allow same-origin geolocation.
12. `package.json` — regression-test and postal regeneration scripts; no new runtime package.
13. `vercel.json` — matching production geolocation policy.

### Created

14. `app/api/admin/orders/route.ts` — protected live order feed.
15. `app/api/geocode/route.ts` — validated, rate-limited same-origin geocoding endpoint.
16. `hooks/useAdminOrdersSync.ts` — non-overlapping two-second polling/focus refresh.
17. `lib/geocoding.ts` — primary/fallback providers, postal matching, normalization and provider safeguards.
18. `lib/data/bangladesh-postal-codes.json` — 1,346-entry directory.
19. `lib/data/bangladesh-postal-codes.README.md` — source, precision and regeneration documentation.
20. `lib/data/nuhil-LICENSE.txt` — upstream district-data MIT license.
21. `lib/data/postal-LICENSE.txt` — upstream postal-data MIT license.
22. `lib/data/whosonfirst-LICENSE.md` — upstream locality-data licensing/attribution.
23. `scripts/generate-postal-data.ts` — reproducible pinned-source generator.
24. `scripts/location-orders.test.ts` — 20 regression tests.
25. `LOCATION_ORDERS_VERIFICATION.md` — this report, acceptance evidence and testing guide.
