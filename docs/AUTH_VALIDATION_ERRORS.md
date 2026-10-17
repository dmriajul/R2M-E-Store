# Professional authentication errors and shared validation

Updated **2026-10-16** · branch `arena/51e78738-r2m-e-store`

This follow-up supersedes the older error copy, advisory customer-login policy, and HTTP setup in the earlier auth/email reports. Existing uncommitted work was preserved. No live database, deployment, Cloudflare dashboard, or production account was modified.

## Findings and before/after

The exact reported “We couldn't find that account… In demo mode try…” sentence was not present in the starting checkout. A stale deployment/build/browser asset remains a possible explanation, not a confirmed diagnosis. Other visible demo references and raw registration error rendering were present and have been corrected.

| Situation | Before | Now |
| --- | --- | --- |
| Unknown email / wrong password | Account hints or older credential copy; the reported deployment also suggested a demonstration account | **Invalid email or password. Please try again.** |
| Correct password, unverified customer | Customer could start a new session immediately | **Please verify your email address before logging in. Check your inbox.** |
| Rate limit | Older rate-limit copy | **Too many failed attempts. Please try again later or reset your password.** |
| Storage/network/unrecognized error | Service-specific or raw response descriptions | **Something went wrong. Please try again later.** |
| Duplicate registration | Short conflict message, rendered from `payload.error` | **An account with this email already exists. Please login or use a different email.** |
| Invalid email | Inconsistent schema wording | **Please enter a valid email address.** |
| Password mismatch | Older mismatch wording | **Passwords do not match. Please try again.** |
| Empty registration | Raw schema issue strings | **Please fill in all required fields.**, plus field-level **Email is required** / **Password is required** |
| Social sign-in unavailable | Suggested email/password “for this demo” | Truthful unavailable-provider warning suggesting email/password sign-in |

Customer verification is checked **only after a successful password comparison**, preventing unknown-email or wrong-password attempts from disclosing verification status. Existing SUPER_ADMIN, legacy ADMIN, and other staff roles remain exempt. Existing sessions are not forcibly revoked, and no verification check was added to checkout. **Existing checkout constraint:** the page is public, but `POST /api/orders` already requires an authenticated session. This task preserves that check rather than introducing guest order placement. Existing signed-in unverified customers can still place orders. Existing unverified customers can use the resend/verification flow before their next sign-in; no records are automatically marked verified.

## Validation rules

Shared definitions: `lib/validations/auth.ts`; existing imports through `lib/validations.ts` remain supported.

- **Email:** required, trim surrounding whitespace, normalize to lowercase, maximum 254 characters, Zod email validation plus a public-domain-format check. Client and registration API use the same definition.
- **Login password:** required and otherwise unchanged. No trimming, case normalization, HTML sanitization, new complexity requirement, or new length minimum for existing credentials. This deliberately preserves legacy passwords instead of making older accounts inaccessible through the form.
- **New registration password:** at least 8 characters, uppercase, lowercase, number, and a non-whitespace special character. Maximum **72 UTF-8 bytes**, avoiding silent bcrypt truncation for newly created passwords. Passwords and confirmation are compared exactly, including spaces.
- **Weak-password copy:** “Password must be at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character.” The request's short example omitted the special-character requirement while its test checklist required one; validation, checklist, strength meter, and copy consistently implement the stronger checklist.
- **Name:** trim, 3–80 characters, reject control characters and `<`/`>`; names are not used as executable HTML.
- **Phone:** optional on both client and API; when present, 7–20 characters consisting of digits and supported phone punctuation/spacing.
- **Confirmation and terms:** required in the new registration form; confirmation must exactly match. For backward-compatible existing API clients, these fields remain optional at the API boundary, but are validated when supplied. The new form always sends them.
- **Submit gating:** invalid form, in-flight request, or unsolved/expired captcha disables submission. Validation runs on change and blur. The server independently revalidates and enforces captcha before any account lookup/write.

Empty/invalid login fields receive inline validation locally. Direct Credentials requests with missing/malformed fields still receive the same generic credential failure as other invalid credentials, assuming a valid security challenge and an unexceeded rate limit.

## Error transport and presentation

`lib/auth-messages.ts` is the public copy catalog. Registration failures return codes, not provider/database strings:

```json
{
  "data": null,
  "success": false,
  "error": "EMAIL_ALREADY_EXISTS",
  "code": "EMAIL_ALREADY_EXISTS",
  "fieldErrors": { "email": "EMAIL_ALREADY_EXISTS" }
}
```

- Existing `success`, `data`, and `error` envelope keys remain; `error` is now a machine code. New UI consumers use `code` and allowlisted field names/codes.
- NextAuth Credentials retains its existing lowercase codes (`invalid-credentials`, `too-many-attempts`, `account-service-unavailable`, `security-verification-failed`) and adds `email-not-verified`. The shared catalog maps these to the professional messages.
- Unknown codes fall back to the generic server error. Raw `payload.error`, SQL/provider details, input values, and unrecognized field names are never rendered by the forms.
- Inline field errors use `aria-invalid`, `aria-describedby`, and alert text. Form-level server failures have a dismissible inline alert as well as a toast.
- Errors are red; verification/rate-limit warnings are yellow. Error/warning toasts have `duration: Infinity` and a close button. Editing, resubmitting, or leaving the form clears stale form feedback/toasts; field-level server errors clear on edits.
- Success notifications use **5,000 ms**. An allowlisted success-code flash in `sessionStorage` lets the global toaster display success **after** the intentional full-page navigation, rather than losing it during navigation. No email, password, token, or arbitrary message is stored. It is consumed once, including in Strict Mode. If storage is blocked, an immediate five-second-configured toast is used without blocking navigation; navigation can naturally end that fallback sooner.
- No browser `alert()` was introduced. The dark/gold UI, Credentials provider, safe callback handling, identity-cache clearing, and single-use captcha reset behavior remain.

### Security decisions

- bcrypt hashing/cost and persisted password hashes are unchanged. Missing, trashed, or malformed-hash records also incur a dummy bcrypt comparison. There is no plaintext password comparison. This reduces the obvious account-existence timing fast path; it does **not** claim constant total HTTP/DB latency.
- Failed sign-ins log only a fixed reason code, not email, password, IP, token, or raw exception contents. Existing outage logging remains generic.
- Existing login throttling is 20 attempts per 15 minutes per IP/process; registration is 10 per 15 minutes. For horizontally scaled deployment, use a shared limiter/WAF and trusted proxy IP handling; this task did not introduce a distributed limiter.
- Duplicate registration deliberately discloses email existence because that message was explicitly requested. Login remains generic. Registration's captcha and throttling remain in place; this is not a claim that the duplicate response prevents registration enumeration.
- Durable account/token transaction, cryptographically random verification tokens, hashed token storage, quota/rotation/replay rejection, deferred `after()` Mailjet handling, RLS/RBAC, and staff access are retained. Email-delivery failure cannot undo a committed account.

## Production demo-copy audit

Removed or replaced visible demo wording in authentication, account deletion, settings, coupons, order/payment errors, analytics/reporting labels, upload feedback, legal FAQ, and payment guidance. Payment copy no longer falsely claims end-to-end encryption or that no real money moves. Unimplemented features are described as unavailable instead of pretending they are connected.

The dashboard's fixture identity/data selection and identity chip are development-only. Internal fixture identifiers, development-only sample data, source comments, historical documentation, and asset paths were not blindly renamed or deleted. They are not credential suggestions or a production authentication source.

The final production browser JavaScript scan found none of these ten markers: `TURNSTILE_SECRET_KEY`, the isolated provider secret marker, `No shopper uses`, `In demo mode try`, `Demo account`, the previous social-demo sentence, the previous payment-demo sentence, the old demo-account error, the sample administrator email, or the sample password.

## Test results

| Check | Result / evidence boundary |
| --- | --- |
| `npx tsc --noEmit` | **PASS**, strict TypeScript, zero errors |
| `npm run lint` | **PASS**, zero errors and warnings |
| `npm test` | **102 passed**, including validation/API, bcrypt/durability, actual auth forms in jsdom, persistent/dismissible feedback, success flash, and existing captcha/cart/security regressions |
| Production build | **PASS**, zero errors; upstream `jose`/Auth.js Edge warnings about CompressionStream/DecompressionStream remain. No warning suppression or auth-provider replacement. Built with Cloudflare's public dummy key for isolated tests; rebuild with the real public site key before deployment. |
| `npm run test:auth:contracts` | **102 message/validation/rate-limit + 51 Turnstile security + 69 customer-journey HTTP checks passed** against the real production standalone/Auth.js handlers, external test-only DB adapter and mocked provider |
| `npm run test:verification:http` | **PASS**, local development HTTP: register → deferred local test email → unverified login denied/no session → public checkout page accessible → actual resend Server Action/quota → rotation → real verification route → replay rejection → verified login/session |
| Browser bundle scan | **PASS**, ten unwanted copy/credential/secret markers absent |
| `git diff --check` | **PASS** |

### Requested scenarios

| Scenario | Observed result |
| --- | --- |
| Empty login email/password | Shared schema and actual form inline errors; disabled submit. Direct HTTP Credentials request: generic failure, no session. |
| Invalid login email | Inline valid-email message; direct HTTP request remains generic. |
| Wrong email / unknown email / wrong password | Same credential code/message; no session. Wrong/unknown redirect queries match. |
| Correct password, unverified customer | Verification-required code/warning; no session. Wrong password never reveals that status. |
| Correct verified customer | Auth.js session/JWT/HttpOnly cookie and dashboard access; customer denied admin APIs. |
| Existing SUPER_ADMIN | Successful login and admin access despite nullable verification; registration complexity is not imposed on login. |
| Too many login attempts | First 20 attempts processed; next attempt returns rate-limit code/message; no session. |
| Server/database failure | Registration unit/API storage failure: 503 with `SERVER_ERROR`, no private diagnostics. Login unavailable/unknown-code mappings use the generic server text. |
| Empty registration | Required-fields code and email/password field codes; no account write. |
| Invalid registration email | 422 / `INVALID_EMAIL`; allowlisted inline error. |
| Weak registration password | Short/no-uppercase/no-lowercase/no-number/no-special cases rejected; UI checklist and meter agree. |
| Mismatched passwords | 422 / `PASSWORD_MISMATCH`; inline confirmation error. |
| Duplicate normalized email | 409 / `EMAIL_ALREADY_EXISTS`; exact professional message, focused email error in jsdom. |
| Valid registration | 201, durable contract-adapter row + hashed token, CUSTOMER role, no password/token in response, no auto-login, verification-pending destination. |
| Missing/invalid/replayed/expired/wrong-action captcha | Rejected; no bypass introduced. |

**Not claimed:** real Cloudflare widget interaction, a desktop/mobile browser visual audit, actual Mailjet inbox delivery, native Prisma/live Supabase integration, or a production deployment. SQL/RLS was not modified by this follow-up. Earlier offline SQL results remain historical evidence, not a new live DB test.

## Reproduce / deployment

From a clean local shell without real DB, auth, or Mailjet credentials:

```bash
npm ci
npx tsc --noEmit
npm run lint
npm test
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA npm run build
npm run test:auth:contracts
```

The finite contract runner starts/stops its own server. Private parent/child IPC rotates a **real random token via the shared verification helper**, then tests use the actual verification route. No automatic verification, production token logging, deterministic token, or application bypass endpoint was added. Never deploy the test preloads/runner. The dedicated development email test setup remains in `AUTH_PRODUCTION_FIXES.md`; stop one server before switching dev/build modes because they share `.next`. Its ignored private bearer-link log was deleted after testing.

For authorized staging, `npm run test:auth:live` now requires **five distinct fresh challenge tokens**, including `TEST_UNVERIFIED_LOGIN_TOKEN`, plus its existing explicit write acknowledgement/origin/DB guards. It verifies denial before verification, then verification and successful login. That live test was **not run** here.

Before release: verify the deployed commit, configure real build-time public and server-only secret keys/allowed hosts, inspect the real database/schema/grants without disabling RLS, test staff and customer paths, verify inbox delivery, deploy a fresh build, and invalidate stale CDN/browser assets if the old sentence remains. No production cache was cleared by this agent.

## Customize messages

1. Edit **`AUTH_MESSAGES`** in `lib/auth-messages.ts` for errors and validation, or **`AUTH_SUCCESS_MESSAGES`** for success notifications. Keep messages free of account suggestions, credentials, SQL, and provider details. Do not rename machine-code keys without updating consumers/tests.
2. For strength rules, update `PASSWORD_RULES` and registration refinements in `lib/validations/auth.ts`; update the weak-password copy and tests together. The meter reads those shared rules. Do not apply new signup rules to login.
3. Change persistent error/warning presentation in `hooks/useAuthFeedback.ts` / `components/auth/AuthFeedback.tsx`; success lifetime is `AUTH_SUCCESS_DURATION` in `lib/auth-flash.ts`, displayed by `components/providers/AppToaster.tsx`.
4. Add any new NextAuth Credentials code to `LOGIN_CODES`; new API fields/codes must be explicitly allowlisted. Never render a server's raw error string.
5. Rerun the checks above and rebuild/redeploy. Editing a source message cannot change already-deployed browser assets.

## Files changed by this follow-up

Application/auth infrastructure:

- `lib/auth-messages.ts`
- `lib/auth-flash.ts`
- `lib/validations/auth.ts`
- `lib/validations.ts`
- `lib/auth.ts`
- `lib/data/users.ts`
- `hooks/useAuthFeedback.ts`
- `components/auth/AuthFeedback.tsx`
- `components/auth/PasswordStrength.tsx`
- `components/auth/SocialButtons.tsx`
- `components/providers/AppToaster.tsx`
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `app/(auth)/auth/verify-email-pending/page.tsx`
- `app/api/auth/register/route.ts`

Production-facing copy / development-only identity gating:

- `app/(shop)/dashboard/layout.tsx`
- `app/(shop)/dashboard/page.tsx`
- `app/admin/actions.ts`
- `app/admin/analytics/page.tsx`
- `app/admin/coupons/page.tsx`
- `app/admin/orders/page.tsx`
- `app/admin/settings/page.tsx`
- `app/api/admin/orders/[orderNumber]/payment/route.ts`
- `app/api/cron/purge-trash/route.ts`
- `components/admin/CouponDialog.tsx`
- `components/admin/CustomerDetailSheet.tsx`
- `components/admin/SettingsForms.tsx`
- `components/checkout/PaymentMethodPicker.tsx`
- `components/checkout/StepPayment.tsx`
- `components/dashboard/OrdersExplorer.tsx`
- `components/dashboard/ProfileForms.tsx`
- `lib/legal-content.ts`

Tests and commands:

- `package.json`
- `tests/auth-flash.test.ts`
- `tests/auth-forms.test.ts`
- `tests/auth-validation.test.ts`
- `tests/auth-durability.test.ts`
- `tests/customer-journey.test.ts`
- `tests/fixture-verification.ts`
- `tests/fixtures/database.mjs`
- `tests/run-auth-contracts.mjs`
- `tests/http-auth-messages.ts`
- `tests/http-customer-journey.ts`
- `tests/http-email-verification.ts`
- `tests/http-turnstile.ts`
- `tests/http-live-auth.ts`

Documentation:

- `docs/AUTH_VALIDATION_ERRORS.md` (this report)
- `docs/AUTH_PRODUCTION_FIXES.md`
- `docs/EMAIL_VERIFICATION.md`
- `docs/CUSTOMER_JOURNEY_AUDIT.md`
- `docs/TURNSTILE.md`

No new dependency, password-hash migration, schema migration, production credentials, or generated build output was added to Git by this follow-up.
