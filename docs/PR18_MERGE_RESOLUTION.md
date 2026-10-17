# PR #18: base-branch merge resolution

Date: 2026-10-17

Merged `origin/Riajul_Khandokar` at `d4b21f78e040c2b0cea2c7421791babc6bb7f594` into the existing `arena/51e78738-r2m-e-store` branch, without switching branches, force-pushing, or merging the PR itself. The shallow clone was deepened first so Git could find the actual common ancestor; unrelated histories were not forced together.

## Resolution decisions

Git reported **21 conflicted files** at this base revision. Each was reviewed; this is a real merge, not a blanket preference for one branch.

- **Login/registration forms:** retained accessible shared validation, generic credential errors, persistent dismissible feedback, safe success flash, development missing-key fallback, explicit captcha placement and required/verified/expired guidance. Registration remains a durable transaction followed by deferred email, never implicit auto-login.
- **Shared validation:** retained the base branch's exported validation/message helpers and forgot-password integration as compatibility adapters over one schema/message catalog. Kept exact passwords, legacy-safe login, five new-registration strength rules, optional phone consistency and the 72-byte signup limit. Unknown/prototype error keys remain safe. Both old and new import paths work.
- **Authentication/security:** integrated the incoming failed-password account/IP lockout with the existing durable bcrypt-only credential service. Five failures per account, or ten across an IP, lock further credential checks for the 15-minute window. Existing endpoint-level throttles are retained too. Expiry and successful-password account reset are covered by tests. No mock credentials, plaintext-password fallback, or fabricated verified users were restored.
- **Audit logging:** preserved a bounded server-side audit trail, but use process-keyed opaque account identifiers instead of recording raw emails/IPs. Logs contain no passwords, challenge tokens, database URLs, or raw provider exceptions. This remains process-local; distributed deployments need a shared limiter/WAF.
- **Dedicated `/api/auth/login`:** retained the new base-branch endpoint, with the same captcha, generic credential failures, shared lockout, and customer verification policy as Credentials. It is credential preflight only and never establishes a session. The form still submits directly to Credentials, avoiding duplicate password checks or single-use captcha token reuse.
- **Verification/roles/storage:** retained random single-use hashed tokens, atomic account/token storage, resend quota/rotation/replay rejection and `after()` Mailjet handling. Customer verification is enforced after a correct password. SUPER_ADMIN, legacy ADMIN and other staff access remain compatible. Existing sessions/order permissions are unchanged; no guest order-placement feature or checkout verification gate was added.
- **Demo cleanup/copy:** combined the incoming cleanup with truthful existing wording. Removed the dashboard's sample-account chip entirely; production already disables fixture identity selection. Kept real order-placement failures rather than falsely reporting local saved orders, and did not claim unconfigured payment/storage integrations were secure/connected.
- **Non-conflicting upstream work:** retained the toast component/helper, five-second global success/info defaults and severity styling, forgot-password validation imports, API response metadata types, and additional UI/comment cleanup.

Conflicted paths: login/register pages; dashboard overview; admin analytics/coupons/orders/settings; admin order-payment API; registration API; admin coupon/customer/settings components; SocialButtons; checkout payment picker/step; dashboard profile forms; `lib/auth.ts`, `lib/data/users.ts`, `lib/legal-content.ts`, `lib/validations.ts`, and `lib/validations/auth.ts`.

## Verification after resolution

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS, zero errors/warnings.
- `npm test`: **116 passed**. New merge regressions cover compatibility exports, account/IP lockout, expiry/reset, opaque audit logging, generic API errors, captcha rejection before DB access, unverified-customer denial, verified access, legacy admin credentials, safe outages, and API/credential-service shared lockout.
- Production build: PASS, using Cloudflare's public dummy site key for isolated testing. Clean builds may emit the pre-existing upstream Auth.js/jose Edge compression warnings.
- `npm run test:auth:contracts`: **130 message/validation/rate-limit + 51 Turnstile security + 69 customer-journey checks passed**. New production HTTP cases exercise `/api/auth/login` captcha/action checks, invalid credentials, unverified customers, staff compatibility, no session cookie and no-store responses. The original 20-request Credentials limiter test uses malformed credentials so it independently tests that limit rather than the stricter failed-password lockout.
- Conflict-marker/index and whitespace checks: clean before commit.

HTTP tests run real Next.js/Auth.js handlers with an external isolated database adapter and mocked Cloudflare. They are not proof of live Supabase/native Prisma, inbox delivery, deployed Cloudflare rendering, or production acceptance. No live schema, keys, RLS policies, or accounts were modified. See `AUTH_VALIDATION_ERRORS.md`, `AUTH_PRODUCTION_FIXES.md`, and `TURNSTILE.md` for previous implementation/deployment context.
