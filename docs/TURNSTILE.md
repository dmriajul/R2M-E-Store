# MUKRA — Turnstile diagnosis, implementation and verification

## Local-development CAPTCHA bypass (2026-10-17)

- **Scope:** `next dev` only. `isTurnstileBypassed()` in `lib/turnstile-shared.ts` returns true solely when `process.env.NODE_ENV === "development"`. Next.js inlines `NODE_ENV` into browser and server bundles, so `next build`/`next start` (production) always verify; the `npm test` runner and isolated HTTP contracts run outside development and are unchanged.
- **Server:** `verifyTurnstileToken()` returns `true` before token validation when bypassed, so a missing/expired/invalid token cannot produce “Security verification failed” locally. It logs a one-time `[turnstile] LOCAL DEVELOPMENT` warning. `isTurnstileServerConfigured()` also reports ready, and the configuration-gap warning is suppressed, in development.
- **Client:** Login, registration and verification-resend forms do not render the widget and do not require a token in development; they show a visible “Security check bypassed in local development” notice instead. No token is fabricated — the credential request simply omits `turnstileToken`.
- **Credentials remain enforced:** the bypass covers CAPTCHA only. The email/password are still validated and checked against the database (bcrypt + lockout). Wrong email or password returns the generic **“Invalid email or password. Please try again.”**; correct staff/customer credentials proceed to the dashboard/session as usual.
- **Production safety:** there is no environment variable that enables the bypass in a production build. The historical statement “No automatic test key or captcha bypass is used” now applies to production/non-development environments only. Never run `next dev` on a publicly reachable host; restart the dev server after pulling this change.
- **Tests:** `tests/turnstile.test.ts` covers the dev bypass (missing tokens, no Siteverify call, immediate strictness outside development); `tests/dev-auth-bypass.test.ts` runs the real Auth.js Credentials handlers with the isolated database and proves a tokenless SUPER_ADMIN login plus `invalid-credentials` for a wrong password; `tests/auth-merge.test.ts` covers the login API with bypassed CAPTCHA and real credential failures; `tests/auth-forms.test.ts` covers the login UI (no widget/token, generic credential feedback). Full `npm test` suite passes.

## Production debug-UI removal (2026-10-17)

- Removed the development-only red **“TURNSTILE DEBUG: Site Key = PRESENT/MISSING”** banner from `components/TurnstileCaptcha.tsx`, together with the development-only client console log of the public key and the development-only “set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in `.env.local`” hint.
- The production auth pages now render only the dark, gold-bordered Turnstile widget (or its neutral **“Security check unavailable. Please refresh.”** fallback) and the accessible status line.
- Missing configuration is diagnosed server-side, once per process, by `warnOnTurnstileConfigurationGaps()` in `lib/turnstile.ts`, invoked from the auth layout. It logs variable **names** only, never values, tokens or hostnames. The widget stays absent and submit stays disabled.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is still read at build time as documented below; changing it requires a rebuild/redeploy.

## Registration visibility and guidance follow-up (2026-10-16)

- Registration always renders a named captcha section immediately above **Create Account**, including the widget/fallback and inline guidance. The button references that guidance with `aria-describedby`.
- Without `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, only the neutral visible security-check fallback remains; no environment-variable hint or debug banner is rendered. Missing configuration is logged server-side. No automatic test key or captcha bypass is used.
- Unsolved captcha keeps submit disabled, with visible instructions explaining why. Enter attempts and actual form-submit attempts show **“Please complete the captcha verification.”** inline, including when other fields are invalid. No registration request is sent without a token.
- Successful verification clears the attempted-submit error and shows a verified status; expiry disables submit and restores required guidance. Other validation and server-side siteverify enforcement are unchanged.
- Checks: strict TypeScript and lint passed; **104 unit/DOM tests** passed, including placement, missing-key fallback, keyboard/submit attempts, no-request enforcement, solved state and expiry. Production build passed; **222 isolated production HTTP checks** passed. The build used a public dummy key. No live Cloudflare/browser-visual claim.


> **Latest auth policy and messages (2026-10-16):** see [AUTH_VALIDATION_ERRORS.md](AUTH_VALIDATION_ERRORS.md). This follow-up supersedes the older advisory customer-login policy, error copy, test counts, and production HTTP setup below. New CUSTOMER sign-ins require verified email after a correct password; staff/admin access and existing checkout permissions remain unchanged. Use `npm run test:auth:contracts` after building for current isolated production HTTP checks.

> **Superseded setup (2026-10-16):** account flows now require a durable database in ALL environments. Production demo fallback is removed. Use [AUTH_PRODUCTION_FIXES.md](AUTH_PRODUCTION_FIXES.md) for current findings, configuration, test commands/results, staging acceptance and monitoring. Earlier demo-auth commands/results below are historical, not current deployment instructions.

Updated: 2026-10-16. Scope: login, registration and verification-email resends. Changes are on the existing Arena working branch; no database operations or production deployment were performed.

## Root cause investigation

The missing widget was primarily an integration/configuration problem, not an established React hydration or CSS defect:

1. Neither Login nor Register imported/rendered the existing captcha component or submitted a token.
2. Neither the registration API nor the actual NextAuth Credentials `authorize` boundary verified a token. Protecting only a client form would not protect direct HTTP requests.
3. The old widget silently returned `null` when the public site key was absent.
4. The old unused verifier accepted any nonempty token when its secret was absent (fail-open).
5. At investigation time this checkout had **no `.env.local` or `.env`**, and neither Turnstile key was present in the process environment. No real credentials were invented or written.

Client boundaries, the existing wrapper's cleanup/deduplication, `reactStrictMode: true`, theme/layout classes and configured response headers were inspected. There was no demonstrated pre-existing hydration crash or CSS rule hiding an integrated widget. Dashboard hostname settings cannot be inspected from this checkout.

## What changed

- Kept the installed `@marsidev/react-turnstile` wrapper; no new production dependency. It renders explicitly and removes widgets on cleanup, supporting React 18/19 Strict Mode. Added jsdom and its types as **development-only** test dependencies.
- Widget initially renders identical SSR/client markup, then mounts in an effect. It uses `appearance="always"`, dark theme and a gold-bordered MUKRA container. Cloudflare's supported **compact** layout (150 × 140) stays centered in narrow mobile forms without resize-driven challenge destruction. The cross-origin Cloudflare iframe is not restyled internally.
- Missing site key, script error, widget/configuration/unsupported/timeout errors, or a 25-second script/render startup watchdog produce exactly **“Security check unavailable. Please refresh.”** Script errors are observed per mount, even if the deduplicated script was created by a previous page. Full refresh is the supported recovery after a blocked script.
- Login, Register and email-resend forms require a token before enabling submit, guard their submit handler and send `turnstileToken`. Expiry/error clears it. Local lifetime is conservatively capped at 250 seconds, below Cloudflare's five-minute maximum.
- Every submission clears the stored token immediately and remounts its widget when the request settles (without resetting the widget underneath an in-flight siteverify call). A failed password, duplicate email, network failure or other unsuccessful attempt must not reuse its already-consumed challenge.
- Verification happens **before credential lookup/password checks** inside Credentials `authorize`, and before account/token creation in `POST /api/auth/register`. Email-resend Server Action verification occurs before account lookup or mail preparation. Existing cheap input parsing/rate limits remain in place.
- Server posts the token and server-only secret to `https://challenges.cloudflare.com/turnstile/v0/siteverify`, with `cache: "no-store"` and a 10-second timeout. It requires boolean `success === true`, the expected action, and an exact trusted hostname. Missing/malformed/oversized tokens, missing secret/host configuration, expired/replayed/invalid tokens, mismatched bindings and provider outages all fail closed. Cloudflare enforces server-side expiry/single use; no token verdict is cached.
- Registration returns HTTP 403 with **“Security verification failed. Please try again.”** Login uses Auth.js `CredentialsSignin` with public code `security-verification-failed`, mapped to the same exact UI message. Resends return that same message. Provider responses, keys, passwords and tokens are not logged or returned.
- Credentials, bcrypt hashing, SUPER_ADMIN and other role handling, JWT/cookie sessions, RBAC/RLS, registration's atomic email-token workflow and deferred Mailjet delivery remain intact. Unverified customers can still log in and check out.

This does **not** claim to protect a review backend: the existing review UI reuses the compatible component, but has no persistence API in this implementation. Public browser keys are public by design; the secret is read only in server call paths. The generated browser build was checked for the secret/config marker, with no matches.

## Cloudflare dashboard and environment checklist

Do these before relying on a deployed login:

- [ ] Create/select a Turnstile widget using **Managed** mode (not Invisible). `appearance="always"` cannot turn an Invisible dashboard widget into a visible widget.
- [ ] Use the site key and secret from the **same widget**. Add `localhost` for local browser testing, the production apex and `www` hostnames that actually serve MUKRA, and the exact preview hostname if testing Arena/Vercel previews. Dashboard entries are hostnames, not URLs/ports/paths.
- [ ] Configure the public key at **build time**. Restart development after environment changes, and rebuild/redeploy production when changing `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- [ ] Configure the secret in server environment settings only. **Never prefix it with `NEXT_PUBLIC_`, put it in `next.config.env`, commit it or paste it into tickets/chat.**
- [ ] Configure trusted hostnames on the server as below. Dashboard approval and server approval are **both** required.
- [ ] Allow browser access to `https://challenges.cloudflare.com`. If a deployment adds CSP, allow the required Cloudflare script/frame/connect origins in that policy rather than disabling CSP. Test browser extensions, DNS/firewall and ad-blocking separately.
- [ ] Permit outbound server HTTPS to Cloudflare's siteverify endpoint. This sandbox's outbound allowlist does **not** include Cloudflare, so its integration proof uses an external mocked provider, not live verification.
- [ ] Complete the real-browser/staging checklist below. Do not deploy a test fixture/preload or dummy secret.

Create an ignored `.env.local` locally (or set equivalent deployment secrets):

```dotenv
NEXT_PUBLIC_TURNSTILE_SITE_KEY="your-public-site-key"
TURNSTILE_SECRET_KEY="your-server-only-secret"
TURNSTILE_ALLOWED_HOSTNAMES="localhost,mukra.com,www.mukra.com"
```

Those placeholders must be replaced through your own environment manager; do not share actual secrets. Prefer a separate staging widget/secret. In production, normally omit `localhost` from the allowlist.

`TURNSTILE_ALLOWED_HOSTNAMES` is a comma-separated **exact** list. Plain hostnames are preferred; complete HTTP(S) origins are also accepted and normalized. Paths, credentials and wildcards are rejected. If nonempty, it takes precedence over fallback origins. If blank, the server derives trusted hostnames from explicitly configured `AUTH_URL`, `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL`. Local loopback spellings (`localhost`, `127.0.0.1`, `0.0.0.0` and IPv6 loopback) canonicalize to the same host, and non-production always includes that local host even when an explicit list is present. Non-local domains remain exact matches. The verifier never trusts an arbitrary request `Host` or forwarded host. Production with neither explicit hosts nor trusted origin configuration fails closed. For an Arena preview, add its exact `{port}-{sandboxId}.e2b.app` hostname to both dashboard and server configuration; never use browser-facing `localhost` for the remote sandbox.

Cloudflare's official test keys can return static `action: "test"` metadata (or omit the action) instead of echoing the form's `login`/`register` action. The verifier accepts that metadata only with the exact official always-pass site/secret pair outside production; it does not assume the interactive widget's token is the separate `XXXX.DUMMY.TOKEN.XXXX` sample token. Real keys still require an exact action and allowed hostname, and all official test secrets fail closed in production. In local development, the server logs whether a non-empty CAPTCHA token reached Auth.js and, on Siteverify rejection, only the provider error codes/action/hostname needed to diagnose the failing check—never the token, secret or credentials.

**Operational consequence:** missing/broken configuration now intentionally blocks login—including SUPER_ADMIN—rather than bypassing bot protection. Configure and smoke-test the production widget before rollout. Existing signed-in sessions are not revoked by this change. The bare checkout displays the fallback and disables auth submission until keys are configured.

Cloudflare's documented dummy public key `1x00000000000000000000AA` is suitable only for isolated widget testing. Dummy-key siteverify responses may have synthetic hostname/action metadata; do not weaken production hostname/action validation to accept them. Use genuine staging keys for end-to-end Cloudflare proof.

## Validation performed

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed, strict typing |
| `npm run lint` | Passed, zero errors/warnings on final lint run |
| `npm test` | **60 passed**: 38 existing tests plus 17 server-verifier and 5 widget/hook tests |
| Production `npm run build` | Passed, 39 static pages; public Cloudflare dummy site key supplied for this isolated build only |
| Build warnings | Auth.js/jose reports CompressionStream/DecompressionStream Edge Runtime compatibility warnings; successful build, not a clean-warning claim |
| `npm run test:turnstile:http` | **48 passed** against production standalone + external mocked siteverify |
| `npm run test:http` | **66 passed**, real Auth.js cookies/JWT/customer/SUPER_ADMIN/RBAC/order flow against demo storage + mocked siteverify |
| Missing-secret production HTTP test | Registration rejected with 403, Credentials callback returned security code, no session issued; **no provider preload** |
| `npm run test:verification:http` | Passed on isolated development server: deferred email, captcha-protected actual resend Server Action, 3/hour, rotation, verify/replay and advisory-session refresh |
| Production auth HTML | Both `/login` and `/register` include their security container and initially disabled submit |
| Browser bundle scan | No `TURNSTILE_SECRET_KEY` or isolated test-secret marker under `.next/static` |
| `git diff --check` | Passed |

Component tests use jsdom, real React SSR/hydration, Strict Mode and the actual installed wrapper with a fake Cloudflare browser API. They assert no hydration/widget console errors, one deduplicated script, cleanup/ignored late callbacks, enable/expiry/reset/error transitions, missing-key/script-failure fallback and local expiry/watchdog timers. Node's test timer API emits an experimental-feature warning; it is not a widget warning.

HTTP tests exercise real application handlers/Server Actions, not a special application bypass. The **external, explicitly opted-in Node preload** simulates Cloudflare success, failure, expiry/replay, wrong action/host, nonboolean success, malformed responses and provider/network failures. Rejected registrations are followed by valid registrations for the same email to confirm the rejected attempt did not create an account. Failed-password tokens cannot be replayed; genuine fresh verification permits existing SUPER_ADMIN login. The fixture refuses configured databases/Mailjet, nonlocal auth origins, non-demo mode or an unexpected dummy secret.

**Not yet validated:** actual visual appearance/interaction or console behavior in a real browser against Cloudflare; real challenge issuance/siteverify, live dashboard/domain configuration, staging connectivity or live database/Mailjet behavior. No real Turnstile keys or browser binaries were available. The public dummy build key is not a deployable production configuration.

## Step-by-step real-browser/staging acceptance test

1. Apply dashboard/environment settings above. Use a separate staging widget if possible. For local development run `npm run dev -- --hostname 0.0.0.0 --port 3000`, then browse **`http://localhost:3000`**. Production/preview uses its actual HTTPS host. Never run development and production servers against the same `.next` concurrently.
2. In a private window, open `/login` and `/register` at desktop and narrow mobile widths. Expect a visible compact dark challenge in the gold container, not a hidden or zero-height iframe. Before success, submit must be disabled. Observe DevTools for CSP/network/hydration/widget warnings. Navigate between pages repeatedly under Strict Mode; expect only one shared API script and no orphaned widgets.
3. Complete the challenge. Submit enables. Let the token expire (or wait >250 seconds); submit disables, a fresh challenge is required, and a fresh token enables it again. No token is stored in localStorage.
4. Register a fresh customer. Check that request JSON contains `turnstileToken`, account creation succeeds, and the pending-email page appears without auto-login. Complete that page's captcha before resending. Confirm original email-verification behavior and quota remain intact.
5. Log in with an existing customer and separately SUPER_ADMIN. The Auth.js Credentials POST includes `turnstileToken`; a valid challenge retains normal credentials, session and role behavior. An unverified customer must still be able to log in/check out.
6. Use a wrong password after completing captcha. Expect the existing credential error, a fresh widget/token, and successful retry only with a fresh token. Repeat with duplicate registration and a simulated network failure. The previous token must not be reused.
7. For direct-request negative tests, use an authorized staging API client, fresh CSRF cookies for Credentials, and **do not share/copy bearer tokens into logs or chat**. Missing, empty, invalid, expired or replayed tokens must never create an account or issue a session. Register returns 403 with the exact security message; Credentials returns `CredentialsSignin` / `security-verification-failed`. Sending a registration-action token to login or a token from an untrusted hostname must fail. Rejected resend actions must not send mail.
8. In isolated staging, remove the server secret temporarily and restart. Valid-looking tokens must still fail closed. Restore the secret. Block the browser API script to check the exact unavailable message and disabled submit; unblock and fully refresh. Temporarily deny server siteverify access to check secure rejection. Never conduct outage tests on the live store.
9. Inspect the production browser bundle/network: only the public site key appears client-side; the secret is never in downloaded code, page props, responses or client requests. Secret is only sent from the server to Cloudflare. Confirm actual Cloudflare analytics/siteverify success with authorized staging keys, then roll out.

## Reproduce offline automated checks

The fixture flags and database behavior changed in the durable-auth follow-up. Use the exact current commands in [AUTH_PRODUCTION_FIXES.md](AUTH_PRODUCTION_FIXES.md#5-reproduce-offline-regressions-no-live-credentials). Do not run the earlier ALLOW_DEMO_MODE/no-database auth setup: it now correctly fails closed.

## Complete file list for this Turnstile task

Earlier audit/email work also remains in this branch. The following list isolates files created or edited **for this task**, including extensions to the prior feature:

| File | Change |
| --- | --- |
| `lib/turnstile-shared.ts` | New browser-safe exact error message/action types |
| `lib/turnstile.ts` | Replaced fail-open helper with strict server-side siteverify validation |
| `hooks/useTurnstile.ts` | New token, local expiry and single-use remount lifecycle |
| `components/TurnstileCaptcha.tsx` | SSR-safe visible widget, lifecycle, error/watchdog and responsive compact layout |
| `app/(auth)/login/page.tsx` | Mount captcha, gate submission, send token, map security error |
| `app/(auth)/register/page.tsx` | Mount captcha, gate submission and send token |
| `lib/auth.ts` | Verify inside real Credentials boundary; dedicated safe error code |
| `app/api/auth/register/route.ts` | Verify before any account/verification-token creation |
| `app/(auth)/auth/actions.ts` | Verify resend action before account lookup/mail preparation |
| `components/auth/ResendVerificationForm.tsx` | Gate resends with action-bound captcha |
| `lib/config.ts` | Correct obsolete comment claiming configuration-free auth |
| `.env.example` | Public/server key and exact-host configuration guidance |
| `.env.production.example` | Same guidance; correct obsolete demo-auth setup claim |
| `package.json`, `package-lock.json` | Development-only jsdom test dependencies, JSX test configuration and HTTP test script |
| `tests/tsconfig.json` | New automatic React JSX transform for component tests |
| `tests/turnstile.test.ts` | New strict verifier/configuration/provider-failure tests |
| `tests/turnstile-client.test.ts` | New SSR/Strict Mode/cleanup/token/error/timer tests |
| `tests/fixtures/turnstile-provider.mjs` | New guarded external siteverify simulator, never an app import |
| `tests/turnstile-http-token.ts` | New explicitly opted-in fixture token generator |
| `tests/http-turnstile.ts` | New real-boundary security/negative/replay/missing-secret HTTP tests |
| `tests/http-customer-journey.ts` | Preserve regression coverage with fresh action-specific test tokens |
| `tests/http-email-verification.ts` | Preserve real resend/email regression with fresh test tokens |
| `docs/EMAIL_VERIFICATION.md` | Mark previous results historical and link current captcha-aware test setup |
| `docs/TURNSTILE.md` | This diagnosis, configuration, validation and acceptance guide |
