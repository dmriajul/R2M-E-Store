# MUKRA — email verification

> **Latest auth policy and messages (2026-10-16):** see [AUTH_VALIDATION_ERRORS.md](AUTH_VALIDATION_ERRORS.md). This follow-up supersedes the older advisory customer-login policy, error copy, test counts, and production HTTP setup below. New CUSTOMER sign-ins require verified email after a correct password; staff/admin access and existing checkout permissions remain unchanged. Use `npm run test:auth:contracts` after building for current isolated production HTTP checks.

> **Superseded setup (2026-10-16):** account flows now require a durable database in ALL environments. Production demo fallback is removed. Use [AUTH_PRODUCTION_FIXES.md](AUTH_PRODUCTION_FIXES.md) for current findings, configuration, test commands/results, staging acceptance and monitoring. Earlier demo-auth commands/results below are historical, not current deployment instructions.

> **Turnstile update (2026-10-16):** the results below describe the original email feature. Login, registration and verification resends now require action-bound Turnstile tokens. See [TURNSTILE.md](TURNSTILE.md) for current configuration, the complete follow-up file list and captcha-aware test commands. Real-browser staging checks still require your own keys.

Implemented 2026-10-16 on `arena/51e78738-r2m-e-store`.

## What changed

The existing registration entry point is **`POST /api/auth/register`**, not a registration Server Action. It now:

1. Validates the request and generates `randomBytes(32).toString('hex')`.
2. Creates the bcrypt-hashed CUSTOMER and an initial verification record **in the same database transaction**.
3. Schedules the MUKRA verification email using Next.js `after(async () => …)` with error isolation.
4. Returns `201` with `data.redirectTo = '/auth/verify-email-pending'`. No bearer token is returned.
5. The registration form navigates to that page **without automatically signing in**.

`GET /api/auth/verify-email?token=…` validates the link, conditionally consumes its record, and updates the live owner's `User.emailVerified` in one transaction. Valid links redirect with 303 to `/auth/verification-success`; missing, malformed, expired, used or replaced links redirect to `/auth/verification-error`. Storage failures also fail safely to the error page. Successful verification does **not** create a login session.

Both the pending and error pages have a **Resend Email** form backed by a Server Action. Unverified users can still sign in and place orders. Checkout shows the optional non-blocking reminder. Existing unverified JWT sessions refresh their advisory verification flag from trusted storage when Auth.js next reads/updates the session; the client cannot set it to true.

## Security and persistence

- Database `User.emailVerified` is nullable `DateTime`; existing accounts remain null without losing login/admin access.
- `VerificationToken` includes the requested ID, identifier, unique token, expiry, and `[identifier, token]` index. It additionally has a **unique identifier** (one current link/email), `resendCount`, and `resendWindowStart` for atomic database-backed throttling.
- The **raw emailed bearer token is never stored**. `VerificationToken.token` is its SHA-256 digest. Do not copy that database value into a verification URL; it is not the link secret.
- Tokens expire after **24 hours**. Successful consumption deletes the record. Replays and superseded links fail. A resend replaces the previous digest/expiry.
- Initial registration plus **three resends per one-hour window** are allowed. The initial email does not count as a resend. The shared counter persists in PostgreSQL; conditional updates inside transactions enforce the per-email limit across application instances. Failed delivery still consumes a resend attempt.
- Resend responses are identical for unknown, already-verified, deleted, eligible and per-email-rate-limited accounts. The UI explicitly explains the three-per-hour limit, without revealing account existence. A supplemental per-process IP limiter allows 20 requests/hour.
- Existing unique/soft-delete checks remain. Initial token upsert replaces any orphaned verification record when a previously purged email is legitimately re-registered.
- Links use configured `NEXTAUTH_URL`, falling back to `AUTH_URL`, **never a supplied Host header**. Production requires a configured HTTPS origin, except an explicitly isolated demo.
- The template escapes the recipient's name, includes the gold **Verify My Email** button, a visible fallback URL, a plain-text alternative, and the expiry notice. Mailjet click/open tracking is disabled for verification messages.
- Verification responses/pages use `no-referrer`; verification pages are no-store/noindex. Explicit Next.js and Vercel header exceptions prevent the global policy from overriding this protection.
- Server delivery errors log a generic message only, not recipients, bearer links, credentials or Mailjet response bodies. An explicit **non-production-only** debug flag allows the local link to be printed when Mailjet is absent.
- No auth provider, RBAC role or existing RLS policy was removed. The additive SQL enables RLS on the new token table with no public policies. Its data should be accessible only through the trusted server database role.

## Files added

| File | Purpose |
|---|---|
| `prisma/changes/20261016_email_verification.sql` | Reviewed additive SQL for an existing database, including new-table RLS. |
| `lib/verification-tokens.ts` | Secure generation, hashing, expiry/constants and process-local demo token storage. |
| `lib/email-verification.ts` | Atomic consumption/verification, resend rotation and persistent per-email quota. |
| `lib/emails/send-verification-email.ts` | Branded HTML/text template, canonical link builder, Mailjet send and local-only debug output. |
| `lib/emails/queue-verification-email.ts` | Awaited `after()` scheduling with sanitized error handling. |
| `app/api/auth/verify-email/route.ts` | GET verification handler and safe status-page redirects. |
| `app/(auth)/auth/actions.ts` | Validated, Origin-protected Next.js resend Server Action and supplemental IP limiting. |
| `app/(auth)/auth/layout.tsx` | Verification metadata/noindex/referrer policy. |
| `app/(auth)/auth/verify-email-pending/page.tsx` | Check-inbox message and resend form. |
| `app/(auth)/auth/verification-success/page.tsx` | Success card with Go to Login. |
| `app/(auth)/auth/verification-error/page.tsx` | Invalid/expired/unavailable message and resend form. |
| `components/auth/ResendVerificationForm.tsx` | Accessible email form, pending state and generic delivery feedback. |
| `tests/email-verification.test.ts` | 18 generation, storage, expiry, resend, template, delivery, session and security regression tests. |
| `tests/http-email-verification.ts` | Local HTTP flow including the actual resend Server Action, rotation, quota, replay and refreshed session. |
| `docs/EMAIL_VERIFICATION.md` | This implementation, deployment and verification guide. |

## Files modified for this feature

| File(s) | Change |
|---|---|
| `prisma/schema.prisma` | Nullable `User.emailVerified`, VerificationToken model/indexes/counters. |
| `lib/prisma.ts` | Add the token delegate to the existing client facade. |
| `lib/data/users.ts` | Optional transactional initial token, demo verification support and trusted status reads. |
| `app/api/auth/register/route.ts` | Generate initial token, register atomically, queue email, return pending-page destination. |
| `app/(auth)/register/page.tsx` | Replace auto-login with verification-pending navigation. |
| `lib/auth.ts`, `lib/auth.config.ts` | Populate the flag at login/session creation and refresh existing unverified sessions server-side. |
| `types/index.ts`, `types/next-auth.d.ts` | Nullable database timestamp and backwards-compatible boolean session/JWT flag types. |
| `components/checkout/CheckoutFlow.tsx` | Non-blocking verification banner; no checkout denial. |
| `lib/mailjet.ts` | Optional tracking controls, 10-second request timeout, check per-message acceptance as well as HTTP status. Existing receipts retain default tracking behavior. |
| `next.config.ts`, `vercel.json` | Verification-specific no-referrer/no-store/noindex header overrides. |
| `app/(auth)/layout.tsx` | Correct shared auth-shell help link to `/contact`. |
| `.env.example`, `.env.production.example` | Document local debug flag and trusted verification origin. |
| `.gitignore` | Ignore `.cache/`, whose optional local test logs can contain bearer links. |
| `tests/customer-journey.test.ts` | Add the new token delegate to the DB fixture. |
| `tests/http-customer-journey.ts` | Add pending/success/error routes, no-auto-login, generic invalid-token handling and unverified login assertions. |
| `package.json` | Add `test:verification:http`; no dependency added. |
| `docs/CUSTOMER_JOURNEY_AUDIT.md` | Mark earlier registration behavior as superseded by this follow-up. |

## Deploy the schema before the application

**The SQL has not been applied to your Supabase database by this session.** Deploying the application with an old generated client/schema can break registration or user lookups.

1. Back up/review the existing database. Apply **`prisma/changes/20261016_email_verification.sql` once** through your controlled SQL deployment workflow, e.g. the authorized staging SQL editor. It assumes the existing MUKRA tables already exist and is transactional. It is not a fresh-database baseline.
2. Confirm the new table is private. The usual trusted Supabase server PostgreSQL role/owner can access it; if your app uses a restricted custom DB role, add the necessary grants and private server-role policies through your existing policy workflow. Never solve this by disabling RLS or granting browser roles access.
3. Generate the matching client in the deployment environment:

   ```bash
   npx prisma generate
   npx prisma validate
   ```

4. This repository has no prior Prisma migration history, so this change is supplied under `prisma/changes/`, not as a pretend initial Prisma migration. Do not blindly run `prisma migrate deploy` against an unbaselined production DB, or `db push`/seed production. Incorporate the additive SQL into your existing reviewed migration process.
5. Set stable auth secrets as usual. Set `NEXTAUTH_URL=https://your-real-domain` (and, if used, matching `AUTH_URL`). For production email configure:

   ```dotenv
   MAILJET_API_KEY=<set privately in deployment settings>
   MAILJET_SECRET_KEY=<set privately in deployment settings>
   MAILJET_SENDER_EMAIL=<Mailjet-verified sender>
   DEBUG_VERIFICATION_EMAILS=false
   ALLOW_DEMO_MODE=false
   ```

6. Deploy the application and complete the real-database/inbox checklist below. Historical users are not marked verified automatically; they can request a link without losing login or checkout access.

## Local manual testing

### Option A: no Mailjet account — use the server console

Only do this on your own isolated development machine. Verification links are bearer secrets: do not enable this on shared/public development deployments, paste the links into tickets/chat, or commit the logs.

1. Install dependencies with `npm ci`.
2. If testing a **real development database**, apply the SQL above and generate Prisma first. If no `DATABASE_URL` is configured, the app uses its existing process-local demo storage; no SQL is needed, but restart/multiple workers lose/split that state.
3. In ignored `.env.local` set:

   ```dotenv
   NEXTAUTH_URL=http://localhost:3000
   DEBUG_VERIFICATION_EMAILS=true
   MAILJET_API_KEY=
   MAILJET_SECRET_KEY=
   MAILJET_SENDER_EMAIL=
   ```

   If you use port 3001, update the URL/command accordingly. Keep `AUTH_URL` aligned if it is also set. Leave **all three Mailjet values blank** for console-only testing. A configured but failing Mailjet account intentionally does not print links as a fallback.
4. Run `npm run dev -- --hostname 0.0.0.0 --port 3000`. Open `/register` in a private browser window and register a fresh customer with a strong matching password.
5. Expect navigation to `/auth/verify-email-pending`, with the requested check-inbox message, **not an automatic session**.
6. In the **server terminal**, look for `[verification:local-only]` followed by the local verification URL. This output is generated by the actual deferred email task. Copy the link into your browser; do not use the database digest as the URL token.
7. Expect `/auth/verification-success` and **Go to Login**. Sign in with the chosen password. If using a real DB, confirm `emailVerified` is set and the token record is deleted with the queries below.
8. Reopen the same link: expect `/auth/verification-error`. Try a missing token, `?token=invalid`, a random 64-hex token, and duplicate `token` parameters: all must fail safely.
9. Register another customer. Request three resends through the pending/error form; each produces a new terminal link. A fourth produces the same generic UI response but **no fourth resend email**. Only the newest link works. Verified/unknown emails show the same generic response and send nothing.
10. Sign in **before** verifying another new account and proceed to checkout. The banner appears without blocking placement. Verify in another tab, then refocus/refresh the session on return; the advisory flag becomes true and the banner disappears. Existing SUPER_ADMIN login remains available.

For an expiry test on a staging-only account, request a new link and set just that test row's `expires` into the past using an authorized SQL editor; the link must go to the error page and not update the user. Unit tests also cover the exact expiry boundary and the one-hour quota reset without waiting.

### Option B: actual Mailjet delivery

Use an authorized development/staging Mailjet account and verified sender, with `DEBUG_VERIFICATION_EMAILS=false`. Set the correct HTTPS origin if not on localhost. Register a fresh email address you control, check Mailjet acceptance and the actual inbox/spam folder, and confirm:

- MUKRA dark/gold HTML, readable plain text, correct name and **Verify My Email** CTA;
- direct first-party URL/fallback URL, 24-hour notice and no click tracking;
- successful database timestamp and token deletion, followed by successful login;
- invalid/replayed/resend behavior and non-blocking checkout.

Simulate Mailjet downtime on **staging only**: registration must still return 201 and retain the account/token, log only a sanitized delivery failure, and allow a later resend. `after()` is not a durable job queue or an automatic retry mechanism.

## Automated checks

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

### Dedicated HTTP email-flow test (isolated demo, not real data)

The test deliberately drives the real Next.js Server Action protocol, using the current local server-reference manifest. It reads the explicit local-only terminal log without printing the bearer URLs. Run with no database/Mailjet credentials configured:

Use the **dedicated development email-test commands in [TURNSTILE.md](TURNSTILE.md#reproduce-offline-automated-checks)**. They supply fresh action-specific tokens through a guarded external siteverify simulator; simply running the old no-captcha HTTP commands now correctly fails closed. The same guide supplies production standalone commands for the broader regression suite. Never deploy the simulator or use its tokens against live Cloudflare.


It checks: registration without auto-login, deferred link, unverified login, three actual resends, suppressed fourth resend, generic unknown/verified-account responses, old-link rejection, verification success, replay rejection and refresh of an already-issued session. The test refuses a non-local URL or non-demo health mode. Stop the server and delete the private log when finished.

Use **`npm run test:http` against the production standalone server** for the wider journey regression, following the standalone setup in `CUSTOMER_JOURNEY_AUDIT.md`. Development Next.js may restart under memory pressure while compiling the entire admin area; that loses process-local demo users and is not a valid durable-store test. The dedicated verification test avoids that full-admin compilation. No automated browser/visual test was run.

## Database checks (authorized staging connection only)

Replace the email below with your dedicated test account. Do not select or publish passwords or raw links.

```sql
-- Before verification: emailVerified is null. After: non-null timestamp.
SELECT id, email, role, "emailVerified"
FROM "User" WHERE lower(email) = lower('verification-test@example.com');

-- Before verification: one row, valid expiry, only a 64-hex digest.
-- After success: no row. Fourth resend must not increment count above 3.
SELECT identifier, expires, "resendCount", "resendWindowStart",
       token ~ '^[a-f0-9]{64}$' AS digest_format
FROM "VerificationToken"
WHERE identifier = 'verification-test@example.com';

-- Confirm token-table RLS is enabled; review private server-role grants/policies.
SELECT relrowsecurity, relforcerowsecurity
FROM pg_class WHERE oid = 'public."VerificationToken"'::regclass;
SELECT policyname, roles, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'VerificationToken';
```

## Verification checklist and observed results

| Check | Result / evidence |
|---|---|
| TypeScript strict checking | **PASS** — `npx tsc --noEmit` |
| Lint | **PASS** — zero errors/warnings |
| Production build | **PASS** — all verification routes generated |
| Unit/regression tests | **PASS — 38** total (18 new email-verification tests) |
| General production HTTP regression | **PASS — 66** checks; unverified login/customer/admin behavior retained |
| Dedicated email HTTP flow | **PASS** — actual registration/deferred callback/Server Action/verification/session flow with demo storage |
| Strong randomness, hashed storage, 24h expiry | **PASS** — generation and storage assertions |
| Single use, superseded tokens, exact expiry boundary | **PASS** — tests; replay/rotation also exercised over HTTP |
| Three resends/hour and reset | **PASS** — service/database-delegate tests, three actual Server Action emails and suppressed fourth over HTTP |
| Registration/verification transaction and conditional-write paths | **PASS mocked delegates**; real PostgreSQL rollback/concurrent-worker test **pending** |
| Mailjet payload/template/acceptance and failure handling | **PASS mocked Mailjet**; production HTTP registration also succeeds with email unconfigured |
| No token leak through referrer / local debug disabled in production | **PASS** — HTTP header and unit assertions |
| Supabase schema applied/generated client validated | **NOT RUN here** — no live DB credentials; Prisma native-engine validation blocked by unavailable `binaries.prisma.sh` |
| Actual Mailjet inbox delivery | **NOT VERIFIED** — no Mailjet credentials/network access in this sandbox |
| Browser styling/banner interactions and deployment HTTPS headers | **Manual staging check required** — HTTP/logic tests are not browser automation |

## Remaining operational notes

- Run schema/client deployment before enabling the code against the existing database. `tsc`/build passing through the repo's Prisma facade is not proof of an applied DB change or a matching generated client.
- Demo users/tokens/counters remain process-local and intentionally non-durable. A real database is required for production.
- Conditional database counters are implemented for multiple instances, but actual competing PostgreSQL transactions were not tested here. Validate a staging concurrency case as part of release approval.
- The per-email limit and uniform copy reduce spam/enumeration; request timing is not padded to be indistinguishable, and the supplemental IP limiter is per process. Use trusted proxy/IP configuration and a shared perimeter limiter at scale.
- GET links can be consumed by automated email security scanners. This follows the requested GET flow. A future interstitial plus explicit POST confirmation would avoid scanner consumption.
- Redact verification query strings in proxy/access logs and analytics. The application does not log raw tokens except the explicitly opted-in non-production console path; infrastructure can otherwise log URLs independently.
- Successful verification pages are informational, not authorization evidence. Only the server timestamp/session flag reflects actual verification. Existing login/checkout authorization does not require the flag, by design.
- There is no durable email queue, delivery audit/outbox or background retry. Monitor sanitized delivery failures and Mailjet events; customers can resend within the quota.
