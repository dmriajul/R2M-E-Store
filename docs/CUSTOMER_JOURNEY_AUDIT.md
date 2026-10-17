# MUKRA — customer login fix and customer journey audit

> **Latest auth policy and messages (2026-10-16):** see [AUTH_VALIDATION_ERRORS.md](AUTH_VALIDATION_ERRORS.md). This follow-up supersedes the older advisory customer-login policy, error copy, test counts, and production HTTP setup below. New CUSTOMER sign-ins require verified email after a correct password; staff/admin access and existing checkout permissions remain unchanged. Use `npm run test:auth:contracts` after building for current isolated production HTTP checks.

> **Superseded setup (2026-10-16):** account flows now require a durable database in ALL environments. Production demo fallback is removed. Use [AUTH_PRODUCTION_FIXES.md](AUTH_PRODUCTION_FIXES.md) for current findings, configuration, test commands/results, staging acceptance and monitoring. Earlier demo-auth commands/results below are historical, not current deployment instructions.

> Historical audit of the login/journey fix. The follow-up [email-verification implementation](EMAIL_VERIFICATION.md) supersedes this report's registration auto-login/schema descriptions and documents the current flow and deployment requirements.

**Audit date:** 2026-10-16

**Branch:** `arena/51e78738-r2m-e-store`

**Baseline:** `acc0f51d0403c1926090df129ab9f59c53e80a7c`

## Executive result

Confirmed code defects in registration/authentication and order submission have been fixed. Credentials, bcrypt, JWT sessions, SUPER_ADMIN, the legacy ADMIN alias, section-level RBAC, and existing RLS policies are retained. No database schema/policy changes were applied, and no live customer records were created or changed.

**Verified:** TypeScript, lint, production build, 20 unit/regression tests, and 60 HTTP checks against the production standalone server. A separate production-server outage experiment verified registration returns 503 and the demo administrator cannot authenticate when a configured database is unavailable.

**Not a production sign-off:** This checkout has no configured Supabase, Mailjet, Mapbox, or deployment auth credentials. Network access is restricted; no live Supabase query, real stock-concurrency test, inbox verification, or browser automation/DevTools session was possible. HTTP tests use real Auth.js CSRF/cookies/JWT/middleware with process-local demo records. Database unit tests use explicitly mocked delegates, not PostgreSQL.

## 1. Root cause analysis

Baseline line numbers below refer to the commit above; current line references refer to this patch.

| Finding | Evidence and impact | Fix |
|---|---|---|
| Registration reported success without retaining the account | Baseline `lib/data/users.ts:300–331`, especially `321–328`: fallback constructs a user and immediately returns it, but never inserts it into a directory. `findUserByEmail` only knew fixed demo accounts. A newly chosen password could never validate after this apparent registration. | Current `lib/data/users.ts:93,184–205,264–331`: process-shared demo directory retains bcrypt hashes and generated unique IDs. Production requires real storage unless an isolated demo is explicitly enabled. |
| Database errors were silently converted into mock success | Baseline `lib/prisma.ts:90–110` catches every query error; both user lookup and registration used it. A missing generated client, unavailable database, stale schema, unique violation, or permission failure could fabricate registration success, or incorrectly switch authentication to demo records. | Current `lib/prisma.ts:122–146`: `withRequiredDatabase` never falls back when a database is configured. Used for auth, registration, checkout catalogue reads, customer order reads, and order creation. Registration returns sanitized 503; login rejects with a generic credential error and logs a safe storage-failure classification. |
| Misleading, account-enumerating login errors | Baseline `lib/data/users.ts:244–285`, `app/(auth)/login/page.tsx:21–36`: separate unknown-email and wrong-password codes exposed account existence and recommended a demo password even on live deployments. | One `invalid-credentials` code; UI displays “Invalid credentials”; unknown-user path performs a dummy bcrypt comparison. No submitted password is logged. |
| Email matching was inconsistent for legacy rows | Baseline `findUserByEmail` lowercased input then used an exact unique lookup. An existing mixed-case database email would not match. | Case-insensitive database lookup; new addresses remain normalized. Case-only duplicate legacy rows must be reviewed separately with the supplied SQL. |
| Potential redirect and environment problems | Login passed an unvalidated callback URL to client navigation. `AUTH_SECRET` used nullish fallback, so a blank template secret stayed blank; an absent production secret otherwise used a public demo secret. | `lib/auth-redirect.ts:2` restricts callbacks to same-origin HTTP(S) paths. Login defaults to `/dashboard` and does a full document navigation so authenticated server content loads freshly. `lib/config.ts:135` treats blank secrets as absent and removes the production demo-secret fallback unless explicit demo mode is enabled. |
| Orders could appear successful after failure | Baseline `components/checkout/StepPayment.tsx:139–210`: creates a random fallback order number, warns on API failure, then still confirms and clears the bag. Baseline `lib/data/orders.ts` also swallowed transactional stock/foreign-key failures via `withDatabase`. | Current `StepPayment.tsx:140` only confirms after an actual successful API response. Failed requests retain the bag. Transaction errors propagate, with stock conflicts returning 409 and storage failures 503. |

**Scope of certainty:** The lost registration and swallowed-failure paths are reproduced code defects. They explain failures in demo/fallback operation. The exact cause on the reported external deployment cannot be distinguished among missing users, unavailable database, schema drift, or environment/cookie configuration without its sanitized deployment diagnostics and live verification. No claim is made that its particular Supabase instance was inspected.

## 2. Authentication, schema and session audit

- Entry points: `lib/auth.ts` and `app/api/auth/[...nextauth]/route.ts`. Credentials provider is unchanged.
- `authorize()` validates the login payload, uses the data-layer bcrypt comparison, and returns `id`, `email`, `name`, `role`, optional phone/image. Database plaintext passwords are now refused; fixed demo plaintext constants are limited to demo mode.
- `User` already has `id`, unique `email`, `password`, `name`, default CUSTOMER role, `createdAt`, `updatedAt`, and soft-delete fields. No schema migration was needed. Registration uses bcrypt cost **10**; duplicate races (`P2002`) return 409. Trashed users cannot sign in and their unique email remains reserved until purged.
- Registration API does not accept a caller-supplied role. HTTP tests submit SUPER_ADMIN and confirm the result is CUSTOMER.
- JWT strategy and **30-day** maximum lifetime retained; `updateAge` explicitly **one day**. Auth.js JWT renewal is not governed by database-session update throttling; `updateAge` is principally relevant to database sessions.
- Middleware remains edge-safe: no Prisma/bcrypt imports. Guests are redirected to `/login?callbackUrl=…`; customers attempting `/admin` go to `/dashboard`; staff sections use the existing matrix. Server layouts/actions/API gates remain in place.
- HTTP tests verify HttpOnly and SameSite=Lax cookies over local HTTP, a later request reading the same session, logout cookie clearing, and denial after logout. **Secure-cookie behavior on actual HTTPS/proxies still requires deployment-browser testing.** No cookie domain override was added, so normal host-only Auth.js behavior remains.
- Set a strong stable `AUTH_SECRET` (or `NEXTAUTH_SECRET`) shared by all instances. Use the actual origin in `AUTH_URL`/`NEXTAUTH_URL`: local port 3000 or 3001 as appropriate, real HTTPS domain in production, preview HTTPS origin for previews. Never force browser-facing API calls to localhost; the application continues using relative URLs.
- Added bounded, per-process login and registration rate limiting. Existing security gates and RLS were not removed.

## 3. Other fixes and journey findings

### Products and bag

- Selected variant stock is resolved from the catalogue; zero-stock selections cannot be added. Existing variant-unique line IDs, quantity limits, totals, removal, header count, and localStorage persistence remain.
- Added `/cart` with quantity controls, removal, subtotal and checkout link; the existing cart drawer remains.
- Checkout now rejects missing/inactive products and never trusts a client price for missing products. Product names/prices are reloaded server-side. Variant-specific prices are **not supported by the existing ProductVariant schema**; all variants use their product price.

### Checkout, pricing, and order ownership

- Order creation requires authentication (401 for guests); public browsing/cart/checkout routes remain available.
- Customer order lookup always requires a session and filters real orders by `userId`, not shipping-recipient email. The unauthenticated `?email=…` lookup was removed. Demo orders also record owner IDs.
- Existing conditional `updateMany` stock decrements stay inside the order transaction, with duplicate variant lines aggregated. Failures can no longer turn into mock order success.
- Opt-in shipping addresses are inserted/deduplicated in the **same transaction** as the order. `state` and `saveAddress` are optional payload additions for backward compatibility.
- Shared BDT totals use **৳80 inside Dhaka**, **৳150 outside Dhaka**, **৳50 gift wrap**, and configured free-shipping threshold (default **৳5,000**). Bangladesh delivery method is derived from district on the server; users cannot select a cheaper Dhaka rate for Khulna. Non-BDT fee defaults are retained. Templates now default to BDT; existing deployment overrides are not changed automatically.
- Checkout confirmation uses server totals and estimated-delivery value, not stale client totals. The confirmation remains the existing checkout step, not a new independently persisted `/success` route.
- Server validation now checks Bangladesh district/postcode, mobile number, valid quantities, and required manual-wallet sender/proof details. COD remains available; bKash, Nagad and Rocket remain manual verification methods. SSLCommerz remains feature-flagged/placeholder, not a working card gateway.
- `after(async () => await sendOrderConfirmationEmail(...))` keeps email non-blocking for the response but allows the platform to await its lifetime. Delivery failures cannot fail the order. The staff test endpoint no longer claims stock was deducted for a mock order.

### Location and post-order views

- Added local postcode lookup: **9204 → Shiromoni, Khulna, Khulna Division**. Checkout fills the district/division and an empty secondary area line; district-default postcode suggestions remain editable. This is a small local table, **not** a complete thana/post-office database.
- Fixed a nullish/ternary precedence error that lost Mapbox locality/neighborhood, and normalized division names with/without “Division”. Mapbox still needs a valid public token, browser WebGL and Mapbox network access; manual address entry remains available.
- Customer status mapping now retains Pending, Confirmed, Processing, Shipped, Delivered, Cancelled and Refunded. Processing/shipped/delivered update the five-step tracking state correctly. Do not fabricate historical shipping/payment timestamps from order creation time.
- Invoice no longer labels unpaid orders “Refunded”. Active-order filters now include pending/confirmed.
- Auth identity changes reset checkout PII as well as existing identity caches without deleting the shopping bag.

### Navigation

- Added `/about`, `/contact`, `/size-guide` and `/collections` (redirect to the existing home collection section), and `/cart`.
- Navbar/footer contact/about links now point to real routes; tracking points to `/dashboard/orders`; registration Terms/Privacy point to the legal routes instead of nonexistent anchors. Mislabelled “Gift Cards” was changed to Accessories (no gift-card implementation exists).
- HTTP checked home, shop, product, cart, login, register, checkout, about, contact, size guide, privacy, terms, returns, shipping, FAQ, collections redirect and a deliberately missing route (404). Product page already has breadcrumb navigation and structured breadcrumbs.

## 4. Acceptance verification

**PASS** means verified at the stated layer, not necessarily live production. **NOT VERIFIED** means external/browser evidence is missing, not a fabricated pass. **FAIL (demo)** describes an actual remaining demo limitation.

| Acceptance criterion | Result | Evidence / remaining work |
|---|---|---|
| Register user in Supabase with hashed password | NOT VERIFIED live; PASS unit/demo | Real bcrypt hash and chosen-password login tested; SQL supplied for live User row. |
| Correct-credentials login | PASS unit + HTTP demo | Auth.js credentials callback, signed cookie, account role and session checked. |
| Wrong/unknown credentials show appropriate generic error | PASS code + HTTP | Same safe failure code; UI copy inspected. Toast rendering needs browser check. |
| Session persists across reloads | PASS HTTP | Separate cookie-bearing session/dashboard requests; browser reload still in manual plan. |
| Protected routes redirect guests | PASS HTTP | `/dashboard`, `/dashboard/orders`, `/admin`. |
| Browse and add to cart | PASS HTTP + store test | Product/page 200 and real Zustand mutations; visual click path not browser-tested. |
| Cart persists in localStorage | PASS unit | Storage adapter and real Zustand rehydration tested with a Storage fixture. |
| Checkout validation | PASS unit/API | Phone, postcode/district, quantities, payment proof; failed orders retain bag by code review. |
| Mapbox picker works | NOT VERIFIED live | Two parsing fixes; token/external API/WebGL unavailable here. |
| Postal 9204 autofill | PASS unit + code | Lookup test and checkout watch/effect wired; browser interaction not tested. |
| Order creation with atomic stock deduction | PASS mocked transaction logic; NOT VERIFIED live | Conditional decrement/aggregation/conflict tested. PostgreSQL rollback/concurrency must be staged. |
| Asynchronous Mailjet trigger | PASS code; NOT VERIFIED delivery | Awaited `after()` callback; no Mailjet account/inbox available. |
| Order in customer dashboard | PASS HTTP/API | Owner sees newly placed demo order even with different recipient email; dashboard/detail routes return 200. |
| Order in admin panel | NOT VERIFIED live; FAIL demo | Real admin reads the same Order table, but demo admin uses its separate seeded UI list. |
| Major navigation links, no 404s | PASS HTTP for audited routes | All primary/required footer destinations checked; external socials and arbitrary historic links not exhaustively crawled. |
| Logout clears session | PASS HTTP | Null session, dashboard redirect, orders 401 after signout. |
| Customer/admin RBAC | PASS unit + HTTP | Customer admin redirect/API 403; SUPER_ADMIN console/staff/dashboard access; legacy ADMIN unit test. |
| `tsc`, lint, build | PASS | Final commands exit 0; final lint: zero errors and zero warnings. |
| No browser console errors | NOT VERIFIED | No browser/DevTools run. Intentional CredentialsSignin server logs occurred on negative tests; no passwords logged. |

### Automated results

| Command / experiment | Result |
|---|---|
| `npx tsc --noEmit` | PASS, zero errors |
| `npm run lint` | PASS, zero errors/warnings |
| `npm run build` | PASS, 36 prerendered pages plus dynamic routes |
| `npm test` | PASS, 20 tests |
| `npm run test:http` against final standalone production build | PASS, 60 HTTP checks |
| Separate configured-unavailable-DB production server | PASS: registration 503, generic credentials rejection, no session issued for demo admin |
| `git diff --check` | PASS |

The initial clean build emitted upstream `jose` CompressionStream/DecompressionStream Edge-runtime warnings. The final incremental build succeeded without warnings. This is not proof of every deployment Edge runtime; validate middleware on the target platform. All temporary test servers were stopped.

## 5. Reproduce locally

### Automated, no real database

Use an isolated checkout without a real `DATABASE_URL`; never run the demo write test against customer data.

```bash
npm ci
npx tsc --noEmit
npm run lint
npm test
npm run build
# Prepare Next's standalone static assets:
cp -r public .next/standalone/
mkdir -p .next/standalone/.next/static
cp -r .next/static/. .next/standalone/.next/static/
# Terminal A; demo mode is ONLY for this isolated test:
HOSTNAME=0.0.0.0 PORT=3000 ALLOW_DEMO_MODE=true node .next/standalone/server.js
# Terminal B:
TEST_BASE_URL=http://localhost:3000 npm run test:http
```

The HTTP suite refuses a non-demo health response, creates one fresh CUSTOMER and a mock order, and tests real CSRF/login/session/logout and negative access. It is **not** a Playwright/browser test. It does not send live email without Mailjet configuration. The unit test defaults assume BDT and default shipping environment values. For local interactive development, `npm run dev -- --hostname 0.0.0.0` works without production demo opt-in. Stop the production demo server after testing.

### Staging deployment setup

1. Configure Supabase `DATABASE_URL`, strong stable `AUTH_SECRET`, actual HTTPS `AUTH_URL`, Mapbox public token, and Mailjet key/secret/verified sender through deployment environment management. Keep `ALLOW_DEMO_MODE=false` in a live store. Do not put secrets in chat or Git.
2. Generate Prisma (`npx prisma generate`) as part of deployment. Compare the live schema with `prisma/schema.prisma` using the project's reviewed migration process. Missing soft-delete/product/order columns must be deployed safely; **do not blindly run `db push` or seed production**. Existing seed/demo administrator credentials are not production credentials.
3. Run `docs/verify-customer-journey.sql` through an authorized staging database connection/SQL editor. Confirm RLS/policies remain unchanged. A configured `/api/health` response is only liveness/configuration, **not proof of database connectivity**.
4. Start the application, then perform the manual scenarios below with a dedicated staging customer and existing staging SUPER_ADMIN.

### Manual release-gate scenarios

1. **Register:** unique staging email, full name/phone, strong password, matching confirmation and accepted terms. Expect auto-login/dashboard. Query User; verify CUSTOMER and bcrypt format without selecting the password/hash. Repeat duplicate and weak/mismatched cases.
2. **Correct login/session:** logout, sign in with chosen password. Expect `/dashboard`; reload twice. Inspect `/api/auth/session` and browser cookies: correct identity, HttpOnly, SameSite=Lax, Secure on HTTPS, host-only cookie. Confirm expiry is not immediate.
3. **Negative login:** existing email + wrong password and absent email + any password must show identical “Invalid credentials” copy. Do not expose which email exists. Submit an external callback URL and confirm it stays on the store.
4. **Browse/cart:** select two real variants, add to bag, verify header count, increase/decrease/remove, reload `/cart`, verify persistence and totals. Try an out-of-stock size/color. No addition should succeed. Check product breadcrumbs and deliberate 404.
5. **Checkout/address:** signed in, enter valid Bangladesh phone, division/district, detailed address and area/thana in secondary line. Enter 9204 and verify Khulna/Khulna Division/empty-area fill to Shiromoni. Test Mapbox search/drag with authorized token and manual fallback. Select Save address and later query Address.
6. **Charges/payments:** verify Dhaka ৳80 versus outside Dhaka ৳150, gift wrap ৳50, free threshold default ৳5,000 (or reviewed deployment setting), COD and manual wallet details. Validate missing sender/proof; never interpret screenshot upload as proof of settlement.
7. **Place order/stock:** record staging variant stocks before placing. Expect 201 with `source=database`, actual order number, authoritative summary/estimated date and Continue Shopping. Verify Order, OrderItem, Address and exact stock delta with SQL. Simulate network/API/stock failure: no success screen and bag retained. With stock=1 in a staging fixture, submit two competing orders: one success, one 409, stock=0, no partial Order/Address/items from the loser.
8. **Post-order/admin/email:** owner sees correct order/status/tracking in dashboard. SUPER_ADMIN sees the same order in `/admin/orders`. Change status via existing admin tools; refresh customer view. Check actual Mailjet send result and customer inbox for MUKRA branding, correct lines/amounts/order number. Verify failed email does not invalidate the order.
9. **Logout/protection:** sign out; session endpoint must be null, dashboard must redirect and customer orders endpoint must be 401. Browser Back must not grant a working authenticated action. Another user must not see the previous user's order/checkout details.
10. **Roles/navigation/browser:** SUPER_ADMIN can reach console, staff and own dashboard. CUSTOMER cannot reach `/admin` or admin APIs. Exercise all navbar/footer links in desktop/mobile. Inspect DevTools Console/Network for hydration, map, upload, cookie or fetch failures. Record browsers tested and evidence before production acceptance.

## 6. Files modified/created

| Files | Change |
|---|---|
| `lib/prisma.ts` | Strict storage helper and sanitized client/query diagnostics. |
| `lib/data/users.ts` | Retained hashed demo users, case-insensitive real lookup, generic failures, production fail-closed behavior, race handling. |
| `lib/auth.ts` | Credentials integration, generic failures, safe storage logging, login limiter. |
| `lib/auth.config.ts` | Explicit session renewal interval; existing JWT/RBAC retained. |
| `lib/auth-redirect.ts` (new) | Same-origin callback validation. |
| `lib/config.ts`, `.env.example`, `.env.production.example` | Production secret handling, BDT templates and explicit demo opt-in. |
| `app/(auth)/login/page.tsx` | Generic copy, safe callback, full authenticated navigation, removed demo password advice. |
| `app/(auth)/register/page.tsx` | Correct links, no demo-password advice, identity reset and dashboard landing. |
| `app/api/auth/register/route.ts` | Registration rate limiting, safe 503 on failed persistence. |
| `app/api/orders/route.ts` | Session/ownership checks, strict catalogue/pricing, district rate, stock/storage status codes, awaited deferred email. |
| `lib/data/orders.ts` | Strict transaction/read path, opt-in saved address, process-shared owner-scoped demo orders. |
| `lib/data/products.ts` | Checkout catalogue queries require storage and active products. |
| `app/api/test-order-flow/route.ts` | Truthful mock stock result, awaited deferred email, sanitized error. |
| `lib/validations.ts` | Checkout district/postcode/mobile/manual-wallet validation, optional saved-address payload fields. |
| `types/index.ts` | Optional shipping fields, complete customer order status union. |
| `lib/cart.ts` | Shared configurable BDT delivery/gift wrap/free-shipping arithmetic. |
| `store/useCartStore.ts` | Reject unavailable variant; configured free-shipping celebration. |
| `store/useCheckoutStore.ts` | Accept server estimated-delivery snapshot. |
| `components/checkout/StepPayment.tsx` | No fake success on failure, retain bag, server summary snapshot and saved-address fields. |
| `components/checkout/StepShipping.tsx` | Postal reverse lookup and district-derived shipping, division normalization. |
| `components/checkout/MapboxLocationPicker.tsx` | Locality/neighborhood parsing fix. |
| `lib/bangladesh-locations.ts` | Local postcode reverse lookup including Shiromoni. |
| `lib/dashboard-orders.ts`, `lib/mock-dashboard.ts` | Accurate statuses/active filters/five-step state; no fabricated event dates. |
| `components/dashboard/OrdersExplorer.tsx`, `components/dashboard/InvoiceDocument.tsx` | Active pending/confirmed orders; accurate unpaid invoice label. |
| `lib/session-cache.ts` | Clear checkout identity/PII on identity changes. |
| `components/layout/CartSheet.tsx`, `app/(shop)/checkout/page.tsx`, `app/(shop)/product/[id]/page.tsx` | Remove hardcoded dollar-threshold messaging. |
| `lib/site.ts` | Repair navbar/footer destinations and labels. |
| `app/(shop)/cart/page.tsx` (new) | Standalone editable persisted bag page. |
| `app/(shop)/about/page.tsx`, `app/(shop)/contact/page.tsx`, `app/(shop)/size-guide/page.tsx` (new) | Dark/gold information/help destinations. |
| `app/(shop)/collections/page.tsx` (new) | Redirect to existing collection section. |
| `tests/customer-journey.test.ts` (new) | 20 security/journey regression tests. |
| `tests/http-customer-journey.ts` (new) | 60 isolated production-server HTTP checks. |
| `package.json` | `test` and `test:http` scripts; no new dependencies. |
| `docs/CUSTOMER_JOURNEY_AUDIT.md`, `docs/verify-customer-journey.sql` (new) | This report, release checklist and read-only integrity checks. |

## 7. Known limitations / remaining release work

1. **Live evidence is missing.** Do not treat mocked transaction assertions as a PostgreSQL rollback/concurrency test, a queued callback as a delivered email, or HTTP rendering as a clean browser console.
2. **Demo storage is process-local and non-durable.** Restarting/multiple workers/serverless instances lose or split registered demo users/orders. Admin demo order UI is a different seeded list; newly created demo orders do not appear there. Use a staging DB for end-to-end admin/order acceptance.
3. **Existing JWTs retain role claims until renewed by sign-in/expiry.** A staff demotion/soft delete does not instantly revoke already-issued JWTs. A token-version/database-session revalidation strategy is a separate hardening task. If production ever used the public demo secret, rotate the secret to invalidate all old tokens.
4. **Plaintext real DB passwords are intentionally rejected**, not silently accepted or automatically migrated. Existing valid bcrypt users/roles remain compatible. Audit malformed/legacy plaintext records and use an authorized password-reset/migration process; this application’s forgot-password/social buttons are placeholder experiences, not working reset/OAuth implementations.
5. **No complete thana selector or postcode database.** Secondary address line remains optional; 9204 area-fill is supported, but full administrative address coverage is not. No latitude/longitude columns were added.
6. **Saved Address rows are persisted by checkout, but dashboard AddressBook/Profile remain client-store driven.** AddressBook does not hydrate/edit the saved database rows. A full saved-address CRUD/profile persistence feature remains separate work.
7. **No variant-price column**; different prices by size/color require a reviewed schema/data/UI change. Do not claim variant-price updates are implemented.
8. **Payment gateways:** mobile wallets are manual approval, SSLCommerz is not an implemented settlement integration. No webhook/reconciliation/idempotent order-submission key was added. A response lost after a committed order can still lead to a duplicate on retry; check order history before resubmitting.
9. **Random five-digit order serials** remain; database uniqueness prevents duplicate IDs, but collisions return failure rather than retrying. No durable email queue/retry/receipt-delivery tracking exists. Historical tracking event timestamps are not stored.
10. **Rate limits are per process**, not distributed; deploy a shared limiter and trusted proxy/IP configuration for multi-instance abuse protection. “Remember me” remains cosmetic; JWT lifetime is always 30 days.
11. **Pre-existing catalogue/demo coupon fallback outside strict checkout/account operations remains.** Public browsing may still show mock data on a database failure; health reports configuration rather than a round-trip readiness query. A complete readiness/outage policy and coupon-usage audit remain advisable.
12. **Content/deployment review:** existing legal pages may retain legacy amounts/estimates; business owners should align policy wording with the new shared Bangladesh rates before launch. Seed price values are not converted automatically by changing the currency template. The new size guide gives measurement advice, not invented garment-specific measurements. External social URLs remain placeholders. Test HTTPS/proxy behavior and clean-build upstream Edge warnings on the deployment platform.
