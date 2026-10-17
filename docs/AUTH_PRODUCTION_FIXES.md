# MUKRA — durable registration/login and visible Turnstile

> **Latest auth policy and messages (2026-10-16):** see [AUTH_VALIDATION_ERRORS.md](AUTH_VALIDATION_ERRORS.md). This follow-up supersedes the older advisory customer-login policy, error copy, test counts, and production HTTP setup below. New CUSTOMER sign-ins require verified email after a correct password; staff/admin access and existing checkout permissions remain unchanged. Use `npm run test:auth:contracts` after building for current isolated production HTTP checks.

Updated 2026-10-16. This guide supersedes the **demo-auth and HTTP fixture commands** in the earlier audit, email and Turnstile reports. No live database, deployed environment, dashboard or production account was modified.

## 1. Findings and root-cause analysis

**Important evidence boundary:** these are findings from the checked-out code and isolated tests, not a claim that the production database was inspected. Neither `.env` nor `.env.local` exists in this sandbox, and database/Turnstile process variables were absent. Your local `.env.local` can exist independently. The exact text “We couldn't find that account” is not in the current application source; seeing it after deployment is a reason to verify the deployed commit/build and clear stale browser assets.

| Issue | Investigation finding | Current remediation/reference |
| --- | --- | --- |
| Successful registration but missing durable account | Previously, `createUser` could return success from process-local user/token maps when no DB was configured. `withRequiredDatabase` also allowed this in production with `ALLOW_DEMO_MODE=true`. State disappeared on restart and was not shared between server instances. | `lib/data/users.ts:238–270` now requires a database and always uses a transaction. `lib/prisma.ts:116–136` cannot enable production demo writes; account paths use the no-fallback helper in every environment. |
| Storage failure looks like bad credentials | Credentials caught database errors and mapped them to invalid credentials. | `lib/auth.ts:73–81`, `lib/auth-messages.ts:4–14`, `app/(auth)/login/page.tsx:68–72`: dedicated outage/rate/security codes and helpful fixed messages. |
| Wrong table/conditions? | Both registration and login use the **same Prisma client and `User` model**, not Supabase Auth. Login normalizes email, matches case-insensitively, reads bcrypt hash and excludes `deletedAt != null`. | `lib/data/users.ts:172–221`; `prisma/schema.prisma:86–116`. In Supabase, inspect the configured schema's **`public."User"` table**, not Authentication → Users (`auth.users`). |
| Password hashing/verification? | bcrypt hashing and compare already existed. They were retained; plaintext/demo-password authentication was removed. | `lib/data/users.ts:214–221,244–254`. The public API never passes a user-selected role into creation. |
| Email verification blocks login? | No: verification is advisory. It was not the cause of this login failure. | No `emailVerified` predicate is applied to credentials lookup. Nullable legacy users, SUPER_ADMIN and legacy ADMIN normalization remain supported. Email creation/resend/consumption, quota and deferred Mailjet flow remain. |
| Could RLS cause it? | Existing policy SQL intentionally denies User INSERT/password reads to browser API roles; it expects Prisma to use the trusted server owner role. A restricted/incorrect server role or FORCE RLS can block reads/writes. The live role/grants remain unverified. | `supabase/migrations/003_rls_policies_accounts.sql:5–16,47–64`; read-only `supabase/check_auth_readiness.sql`. **Do not disable RLS or grant password access to anon/authenticated.** |
| Missing schema/client? | Missing verification columns/table or an ungenerated client must fail rather than fabricate success. Initialization failure was also latched in process state. | `lib/prisma.ts:53–80` fails closed in production and no longer latches initialization failures. `app/api/auth/register/route.ts:102–110` returns 503. |
| Turnstile absent/no CDN request | Both forms already imported/rendered the component and it had no null return in this checkout. There was an extra effect-controlled mount gate; the auth card also started at opacity zero, making content dependent on successful client animation/hydration. Dashboard/browser/CDN state is not observable here. | `components/TurnstileCaptcha.tsx:82–105` renders the wrapper whenever the trimmed key exists, including its SSR container; `components/auth/AuthCard.tsx:20–22` starts visibly at opacity 1. |
| Public key/configuration silent failure | `NEXT_PUBLIC_*` is embedded into browser code at build time; a correct runtime `.env.local` value cannot repair an old production bundle. A script absent from Network can also mean hydration never ran, browser blocking, or missing build-time key. | `components/TurnstileCaptcha.tsx`: the development-only red debug banner, its key-presence display and the development public-key console log were removed. Missing configuration renders only the neutral “Security check unavailable. Please refresh.” fallback with submit disabled; deployment logs get a server-side warning without key values (`warnOnTurnstileConfigurationGaps` in `lib/turnstile.ts`). No server secret/token logging. |
| Script handling | Kept the installed maintained wrapper, singleton script and cleanup. The expected initial script is **`https://challenges.cloudflare.com/turnstile/v0/api.js`**, not necessarily `challenge.js`. | `components/TurnstileCaptcha.tsx:4,58–79,98–102`; actual wrapper script URL asserted in component tests. |

### Behavior now enforced

- `201` registration means the account transaction committed. Initial verification-token insertion failure rolls back the account. Duplicate normalized emails produce a conflict, including races. Password hashes never leave the server.
- Accounts previously created only in memory cannot be recovered after that process is gone. Do not reset real persisted users; use a verified support/re-registration process for genuinely lost demo-only registrations.
- No DB → registration 503 and Credentials code `account-service-unavailable`, **not** a mock account. `ALLOW_DEMO_MODE` cannot change this. Shared production database helpers do not serve mock data after missing configuration/query failures. The old staff demo directory is explicitly development-only and cannot authenticate anyone.
- Invalid email/password combinations share **“Email or password is incorrect. Check your details or create an account.”** This helps users without revealing which emails are registered. Outages use **“Account service is temporarily unavailable. Please try again later.”** Rate limiting and captcha have their own messages.
- Successful real customer/admin authentication retains the Credentials provider, bcrypt cost, JWT/cookie and role behavior. No new verification gate, no password rewrite, no RLS/RBAC removal.
- Turnstile uses dark/compact/always-visible settings in a gold-bordered container. Missing key/script/render failure displays **“Security check unavailable. Please refresh.”** A `<noscript>` warning explains the JavaScript requirement.
- Startup watchdog is now **five seconds**. **It does not allow unverified submission.** The requested fail-open fallback conflicts with the acceptance criteria (“blocked until captcha solved”) and prior mandatory server enforcement. Missing/invalid tokens still fail at the server, so enabling only a client button would be misleading rather than a usable fallback.
- Tokens expire, are cleared before submission and widgets reset after the request settles. Siteverify still enforces strict boolean success, single use/expiry, action, hostname and a bounded request. Network/provider/configuration errors fail closed.

## 2. Verification results and remaining acceptance work

| Test/check | Result and limits |
| --- | --- |
| Strict TypeScript / ESLint | `npx tsc --noEmit`, `npm run lint`: passed, zero errors; final lint has zero warnings |
| Unit/component suite | **70 passed** via `npm test` |
| Registration regression | Real registration handler → independently inspect **test database contract adapter** row → bcrypt compare → credentials service succeeds. Also checks token digest, CUSTOMER role, nullable defaults, transaction rollback, duplicate concurrency and no-DB rejection. Not a live Prisma/Supabase proof. |
| Login regression | Unknown email and wrong password fail consistently; valid customer/persisted admin/legacy role succeed. Distinct outage and rate/security message mapping checked. Actual Auth.js cookies/session/RBAC also exercised by HTTP tests. |
| Turnstile regression | Actual wrapper + jsdom/React SSR/hydration/Strict Mode: login/register widget containers exist with a mocked public key, CDN script tag is emitted, script deduplicates, cleanup/late callbacks/expiry/reset/errors work, five-second warning does **not** enable submit, no debug banner exists in any environment. No hydration/widget console errors in the test. Not a real CDN/browser visual test. |
| API-level customer journey | **66 HTTP checks** against production standalone, configured-database code path, **external test-only DB adapter and mocked Cloudflare**: registration, fresh chosen-password login, customer/admin sessions/RBAC, checkout and owned order retrieval. Cart behavior separately covered by store tests. Not browser automation. |
| Direct security requests | **48 HTTP checks**: missing/invalid/expired/replayed tokens, wrong action/host, provider failure, no session/account creation, fresh verification with wrong/correct credentials and SUPER_ADMIN access. Same external fixtures. |
| Email journey | Dedicated development HTTP test passed: deferred email, actual captcha-protected resend Server Action (3/hour), rotation, verification/replay and session flag refresh. Test-only DB adapter; no inbox delivery claim. |
| Production no-DB probe | Actual APIs returned registration 503 and Credentials `account-service-unavailable`, issued no session and readiness 503, **even with `ALLOW_DEMO_MODE=true`**. Only siteverify externally mocked; no DB adapter/preload was installed for that probe. |
| PostgreSQL/RLS suite | **103 passed** using existing migration SQL against disposable PGlite PostgreSQL/WASM. Owner/API-role separation remains intact. |
| Additive auth schema SQL | **9 passed** against disposable PGlite: bcrypt row, nullable defaults, SHA-256 token storage, atomic rollback, anon/authenticated password/token isolation, owner verification update. This applies the real reviewed additive SQL to an offline schema; not a deployed migration or native Prisma client test. |
| Production build | Passed with zero build errors, using Cloudflare's public dummy key for this isolated build. Rebuild with the genuine deployment public key before release. |
| Production HTML / readiness | Both auth containers, disabled submit and nonhidden cards verified; `/api/ready` 200 with the test adapter, 503 without database. Browser build contains no server-only Turnstile secret/config marker. |
| Live regression command | `npm run test:auth:live` correctly **failed its configuration guard**, because authorized staging connection/challenge tokens were not provided. It did not pretend to pass or perform live writes. |
| Git whitespace check | `git diff --check`: passed |

### Not yet checked — do not mark the production incident resolved until these pass

- Fresh registration row visible in the actual Supabase `User` table and readable by the deployed Credentials connection, across server restart/instances.
- Generated native Prisma client and authorized staging/production schema/grants. Previous Prisma tooling attempts were blocked by native engine download restrictions; no live schema command was executed here.
- Real Cloudflare challenge issuance/siteverify success, dashboard hostname allowlist and browser/CDN connectivity.
- Actual desktop/mobile browser rendering and absence of console errors, including browser extensions/CSP. No browser binary/live provider keys were available.
- Actual Mailjet inbox delivery. Deferred failures still cannot undo a committed account, but delivery is best-effort, not a durable job queue.

## 3. Production deployment checklist

1. **Back up and inspect authorized staging first.** Confirm deployment branch/build and which Supabase project/schema both auth endpoints use. This app writes through Prisma, not Supabase Auth.
2. Run `supabase/check_auth_readiness.sql` privately **as the same DB role as the app**. Check owner/BYPASSRLS contract, table/column access, correct schema and non-forced RLS. Keep existing RLS policies enabled; never expose server DB credentials or password columns to browser roles.
3. Ensure deployed schema matches `prisma/schema.prisma`, including nullable `User.emailVerified`, `deletedAt`, and `VerificationToken` fields/indexes. If not already applied, review `prisma/changes/20261016_email_verification.sql` with your migration owner before applying through your normal workflow. It is an additive change, not idempotent SQL or a fresh baseline. **Do not blindly `db push`, seed or re-run it against production.**
4. Generate Prisma on a build host with supported native engine access: `npx prisma generate`. Match generated client, deployed schema and dependency lockfile. Use the appropriate Supabase pooler/session/direct connection settings for interactive transactions, SSL and deployment networking; configure connection/pool/statement timeouts and limits with your database administrator.
5. Set `DATABASE_URL` (server only) and a strong `AUTH_SECRET` or `NEXTAUTH_SECRET`. Keep the existing production Auth.js secret when deploying to avoid signing everyone out. Set `AUTH_URL`/`NEXTAUTH_URL` to the correct HTTPS origin. Remove `ALLOW_DEMO_MODE`; it is no longer supported for production fallback. There is no hardcoded production Auth.js secret.
6. In Cloudflare select a **Managed visible** widget. Set matching `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and server-only `TURNSTILE_SECRET_KEY` from the same widget. Allow `localhost` for development, production apex/`www`, and the exact staging/preview hostnames used. Never use an Invisible dashboard widget when expecting a visible challenge.
7. Set `TURNSTILE_ALLOWED_HOSTNAMES` to a comma-separated exact server allowlist (hostnames preferred; HTTP(S) origins are normalized; no paths/wildcards); omit loopback hosts in production. If blank, the server derives hosts from configured AUTH_URL/NEXTAUTH_URL/NEXT_PUBLIC_SITE_URL. In local development, `localhost`, `127.0.0.1`, `0.0.0.0` and IPv6 loopback are canonicalized as the same host, including when an explicit list is present. Never trust arbitrary request Host headers for this check.
8. **Build-time public key:** restart development or rebuild/redeploy production after changing the site key. Environment files on your laptop do not configure Vercel/Docker automatically. Do not prefix secrets with NEXT_PUBLIC_ or put them in `next.config.env`. Do not deploy dummy keys, test-provider preloads or test DB adapters.
9. Permit browser script/frame/connect access and server HTTPS siteverify requests to `challenges.cloudflare.com`. If CSP is configured upstream, allow the required Cloudflare origins without disabling the policy. Test outside ad-blockers and corporate DNS/firewalls. This sandbox cannot reach Cloudflare through its outbound allowlist.
10. Verify `/api/ready` returns **200**, then run the actual-browser and authorized live tests below. `/api/health` is liveness/configuration only; it cannot prove database connectivity. Readiness probes the auth/token schema with a five-second response bound, but **does not prove write privileges, RLS visibility or external provider connectivity**. A timed-out DB operation may continue until the DB driver's own timeout.
11. Confirm existing customer and SUPER_ADMIN login with **fresh** captcha tokens. Confirm legacy ADMIN normalizes to SUPER_ADMIN and no password/user data was rewritten. Deploy only after the rollout checks pass; never restore a demo bypass as incident mitigation.

## 4. Real browser / staging test steps

1. Configure keys and trusted hosts, restart/rebuild, then open `/register` and `/login` directly in a private browser window. The only CAPTCHA UI is the dark Turnstile widget inside its gold-bordered container; no debug banner, key-presence indicator or client-side key log exists in any environment. If the public key is missing, the neutral “Security check unavailable. Please refresh.” fallback replaces the widget and submit stays disabled; deployment logs carry the server-side configuration warning. No raw secret or token is logged.
2. If no widget container appears, verify deployed commit, correct URL/page, JavaScript bundle loading and stale browser/CDN assets. Auth card should be visible even before animation. If the neutral fallback is shown, verify exact variable name, no empty/whitespace value, project-root env file and **build-time** deployment settings.
3. With PRESENT, Network should show `https://challenges.cloudflare.com/turnstile/v0/api.js?...`. No request means inspect JavaScript/hydration and script blockers first. A blocked script must show the warning within five seconds; submit remains disabled. Fully refresh after unblocking. Do not inject a second API script beside the wrapper.
4. With correct dashboard mode and hostname allowlists, confirm visible compact dark challenge inside the gold container at narrow mobile/desktop widths. Complete it: submit enables. Wait beyond the local 250-second lifetime: submit disables; fresh verification enables it again. Navigate between auth pages repeatedly and inspect for duplicate-script/widget or hydration warnings.
5. Register a unique customer using a strong chosen password. Expect 201 with `source: database`; look up the same returned id/email in Supabase Table Editor **public.User**, confirming NULL `deletedAt`, NULL `emailVerified`, CUSTOMER role. Never copy/share hashes. No database row means the test fails regardless of the UI message.
6. Log in immediately with a fresh login challenge. Verify session id matches the stored id. Login should work before email verification; verification and resend flow still work independently, including token rotation/single use and the three/hour quota.
7. Wrong password and unknown email produce the same helpful non-enumerating credential message. In authorized staging, simulate unavailable DB/schema: registration returns 503 and login reports temporary account-service failure, not nonexistent account. Restore service and retry with a new captcha.
8. Add an in-stock variant to the bag, check out with COD in authorized staging, and verify the created order in the database belongs to that user. Confirm the server reprices lines and decrements the right stock. Do not create test orders on the live store.
9. Check browser Console for errors and Network for successful siteverify-backed auth. Repeat with the existing SUPER_ADMIN account and verify customer requests still cannot access admin APIs. Clear test cart/session. Keep test records private and clean them up through your reviewed staging process.

### Opt-in live database regression

`npm run test:auth:live` does **not** mock the database or Cloudflare (the Node runner emulates browser localStorage for its cart-store check). It refuses to run without an explicit staging-write acknowledgement, matching origin, database URL and five fresh distinct Cloudflare tokens. Never paste these credentials/tokens into chat or commit them.

Set privately in the runner environment:

- `RUN_LIVE_AUTH_REGRESSION=I_UNDERSTAND_THIS_WRITES_TEST_DATA`
- `TEST_BASE_URL` and `TEST_STAGING_ORIGIN` to your exact authorized staging HTTPS origin.
- `DATABASE_URL` to that **same staging database**, with generated Prisma client available.
- `TEST_REGISTER_TURNSTILE_TOKEN` with action `register`; `TEST_UNKNOWN_LOGIN_TOKEN`, `TEST_WRONG_PASSWORD_TOKEN`, `TEST_UNVERIFIED_LOGIN_TOKEN`, `TEST_LOGIN_TURNSTILE_TOKEN` with action `login`. Obtain **unused** challenges from that staging host/widget through authorized browser tooling. Tokens already submitted to the form cannot be reused. Run promptly before expiry; failures due to expired tokens are not an authentication success.
- `TEST_CREATE_STAGING_ORDER=true` to include cart-store → real checkout API → independent order-row read. Without this explicit flag, the command reports that order testing was not enabled.
- Unset `NODE_OPTIONS` fixture preloads, `TEST_ISOLATED_AUTH`, `TEST_DATABASE_ADAPTER` and `TURNSTILE_TEST_PROVIDER`.

The test creates a uniquely named customer, independently reads and verifies the real stored row/hash, checks unknown/wrong Credentials requests and denial of unverified sign-in, rotates a verification link using authorized server DB access, exercises the real verification route and checks the verified column and successful sign-in using a fresh challenge token. That step is **not** a Mailjet inbox test. Optional checkout uses available staging catalogue/stock and creates a COD order. Test records are deliberately retained for inspection and authorized cleanup. The command prints no passwords, tokens, bearer links, emails, database URLs or raw provider/query failures. It is API/store automation, not a real browser visual test.

## 5. Reproduce offline regressions (no live credentials)

```bash
npm ci
npx tsc --noEmit
npm run lint
npm test
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA npm run build
cp -r public .next/standalone/
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/
```

For current production HTTP tests, use the finite, guarded runner (no live credentials in the shell):

```bash
npm run test:auth:contracts
```

It starts and stops a production standalone server with external fixtures, runs message/rate/security/journey checks, and rotates random verification tokens via private parent/child IPC before using the real verification route. There is no test bypass route or automatic verification. The DB double is not live Postgres proof; never deploy the preload/runner. Earlier standalone manual commands cannot provide the new private IPC channel.

For the dedicated deferred-email development flow, stop production first (both use `.next`). Terminal A:

```bash
mkdir -p .cache
env -u MAILJET_API_KEY -u MAILJET_SECRET_KEY \
  TEST_ISOLATED_AUTH=true TEST_DATABASE_ADAPTER=isolated \
  DATABASE_URL=postgresql://isolated.invalid/mukra-test \
  AUTH_SECRET=isolated-auth-secret-never-deploy AUTH_URL=http://localhost:3100 \
  NEXTAUTH_URL=http://localhost:3100 AUTH_TRUST_HOST=true DEBUG_VERIFICATION_EMAILS=true \
  NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
  TURNSTILE_ALLOWED_HOSTNAMES=localhost \
  TURNSTILE_SECRET_KEY=isolated-test-secret-not-a-live-key TURNSTILE_TEST_PROVIDER=isolated \
  NODE_OPTIONS="--import $(pwd)/tests/fixtures/auth.mjs" \
  npm run dev -- --hostname 0.0.0.0 --port 3100 > .cache/critical-auth-verification.log 2>&1
```

Terminal B:

```bash
TEST_BASE_URL=http://localhost:3100 TEST_DATABASE_ADAPTER=isolated \
  TURNSTILE_TEST_PROVIDER=isolated VERIFICATION_TEST_LOG=.cache/critical-auth-verification.log \
  npm run test:verification:http
```

That log contains bearer links. Stop the process and delete it immediately after testing; do not publish/commit it. All servers were stopped and private test logs removed during this implementation.

Optional offline SQL/RLS suites (PGlite is a disposable test tool, **not** an application dependency):

```bash
npm install --no-save --package-lock=false @electric-sql/pglite@0.3.14
node supabase/tests/rls.test.mjs
node supabase/tests/auth-storage.test.mjs
npm ci # restore exactly the lockfile dependencies before builds
```

These SQL tests use only disposable PostgreSQL/WASM storage; the existing rollback SQL is tested there, never against Supabase. No new production package was added for this task.

## 6. Monitoring and regression prevention

- Poll **`/api/ready`**, not just `/api/health`. Alert on sustained 503s or readiness latency near five seconds. Treat configuration “present” as different from actual successful writes/CDN verification.
- Count registration 201/409/403/429/503 separately and Auth.js `invalid-credentials`, `account-service-unavailable`, `too-many-attempts`, `security-verification-failed` codes. Alert on sudden auth/storage failures or drop in challenge completions relative to page views. Establish normal rates before choosing thresholds (for example, >1% service failures for five minutes).
- Server logs already have safe fixed `[registration] Account storage unavailable`, `[auth] Credential storage unavailable`, and verification-delivery-failure events. Attach a redacted request/deployment correlation id in your monitoring layer, not user credentials/body dumps.
- Never capture request bodies from registration/login/siteverify, cookies/JWTs, passwords, tokens, verification query strings, environment files, database URLs or provider response bodies. Scrub APM/network breadcrumbs and proxy logs, including query strings on verification URLs.
- Run TS/lint/unit/build checks in CI; run HTTP suites on an isolated fixture process that always stops. Run the opt-in real-DB synthetic journey on staging after schema/env changes and periodically with dedicated test accounts/catalogue, not customer data. Match the returned registration id to an independent DB read—UI success alone is insufficient.
- Add real-browser desktop/mobile checks on staging with an authorized Cloudflare widget, capture hydration/CDN failure signals without secrets, and track Cloudflare widget analytics. Do not weaken hostname/action binding to accommodate dummy-key metadata.
- Keep a schema-before-code rollout and reviewed rollback plan. Never re-enable demo authentication to mask a database incident. A fail-closed outage is preferable to false account/order success or known-password administrator access.

## 7. Complete file list for this follow-up task

Earlier uncommitted audit/email work was preserved. This list isolates this task's edits:

**Application/configuration edited:**
- `lib/prisma.ts` — required durable helper, production no-fallback behavior, retryable initialization.
- `lib/data/users.ts` — DB-only lookup/create/status, always-transactional creation, remove in-memory registration/plaintext login, guard legacy dev directory.
- `lib/email-verification.ts`, `lib/verification-tokens.ts` — DB-only verification/resend; remove process-memory token store; preserve secure random token generation/hash/expiry.
- `lib/auth.ts` — useful typed Credentials error codes, retain real admin/legacy roles.
- `app/(auth)/login/page.tsx` — map safe server error messages.
- `app/api/auth/register/route.ts` — correct durable-only route documentation; existing failure response retained.
- `lib/turnstile.ts` — non-disclosing server configuration readiness helper.
- `components/TurnstileCaptcha.tsx` — direct key-present render, dev public-key log, five-second warning, noscript message.
- `components/auth/AuthCard.tsx` — visible initial SSR card.
- `lib/config.ts`, `lib/demo-mode.ts`, `app/api/health/route.ts` — no production fallback secret/demo health claim; distinguish configuration from readiness.
- `.env.example`, `.env.production.example` — required auth/database configuration and safe rollout guidance.
- `prisma/schema.prisma` — corrected setup comments only; no schema/model alteration in this follow-up.
- `package.json` — opt-in live auth regression script; no new runtime/development dependency for this follow-up.

**Application/diagnostics created:**
- `lib/auth-messages.ts` — browser-safe typed messages.
- `app/api/ready/route.ts` — bounded, uncached, non-disclosing readiness endpoint.
- `supabase/check_auth_readiness.sql` — read-only role/schema/RLS diagnostic; not executed against a live database.

**Tests created/edited:**
- `tests/auth-durability.test.ts` — API storage/login, rollback, duplicate races, no-DB/no-demo, outage and readiness cases.
- `tests/support/test-database.ts` — test-only typed transactional contract adapter, never an app import.
- `tests/fixtures/database.mjs`, `tests/fixtures/auth.mjs` — external isolated DB fixture and combined preload.
- `tests/fixtures/turnstile-provider.mjs`, `tests/turnstile-http-token.ts` — explicit isolated-provider guard, no application demo assumption.
- `tests/customer-journey.test.ts`, `tests/email-verification.test.ts` — move former demo-account tests onto explicit DB contract fixtures.
- `tests/turnstile-client.test.ts` — action-specific immediate-render/CDN-container checks and five-second fail-closed timing.
- `tests/http-customer-journey.ts`, `tests/http-email-verification.ts`, `tests/http-turnstile.ts` — configured-database path with external fixtures and accurate claims.
- `tests/http-live-auth.ts` — opt-in actual database/Cloudflare/API/store staging regression, no mocks.
- `supabase/tests/auth-storage.test.mjs` — disposable real PostgreSQL/WASM additive-schema/transaction/RLS smoke.

**Documentation:**
- `docs/AUTH_PRODUCTION_FIXES.md` — this report and current commands/checklists.
- `docs/TURNSTILE.md`, `docs/EMAIL_VERIFICATION.md`, `docs/CUSTOMER_JOURNEY_AUDIT.md` — historical notices and links to the current durable-only setup.
