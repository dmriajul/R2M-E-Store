# Turnstile authentication incident

## Root cause and investigation (2026-10-22)

1. **Environment:** no `.env.local` exists in the checkout. Vercel connector inspection of `2r-m-store` found `NEXT_PUBLIC_TURNSTILE_SITE_KEY` scoped only to Production. The public value has no surrounding whitespace; its ownership, type and pairing must still be confirmed in Cloudflare. The project environment listing contained no `TURNSTILE_SECRET_KEY` and no Preview/Development keys. No secret was retrieved or changed. Team-shared or external configuration was not audited, so deployed runtime secret availability remains unverified. Public variables are baked into Next.js bundles: configuration changes require a new build/deployment.
2. **Domains:** Vercel lists only `2r-m-store.vercel.app`, verified, with no custom domain. Cloudflare dashboard access is not available; its hostname allowlist and Managed mode remain unverified. Configure `localhost`, `127.0.0.1`, production, and explicitly approved preview hosts in Cloudflare. Separately configure the server's `TURNSTILE_ALLOWED_HOSTNAMES` (or its existing trusted URL configuration); this does not modify Cloudflare's allowlist.
3. **Confirmed client defect:** installed `@marsidev/react-turnstile` 1.6.1 deletes `window[onLoadCallbackName]` when `scriptOptions.onError` is supplied, during script insertion. Our component supplied this option, destroying the callback it had just registered. Without another mount repairing it, the API script cannot signal readiness and the widget stays loading. Removed that option; retained capture-phase resource-error handling. Regression test asserts the global callback remains registered. No CSP blocking Cloudflare was found in `next.config.ts`.
4. **Failure-state defects:** `onError` previously returned to loading; there was deliberately no timeout and no Retry. Added bounded loading, distinct error/timeout state, manual reset/reload, fallback guidance, missing-key console diagnostic and a React error boundary. Development previously skipped the widget and verification entirely; it now exercises the same flow as production.
5. **Server:** Siteverify already used a POST body, no caching, a 10-second abort signal, exception handling, action/hostname binding and production test-key rejection. Preserved these. Added production-safe rejection logging. Login/register JSON APIs now return HTTP 400 with `error: "invalid_captcha"` and retain `code: "SECURITY_CHECK_FAILED"` for the existing UI. Auth.js Credentials retains its own redirect/error protocol and single-use token flow.

## Patch summary

- `components/TurnstileCaptcha.tsx`: loader callback fix, render deadline, retry, explicit configuration error, resource failure logging and local error boundary; existing dark/gold appearance retained.
- `lib/turnstile.ts`, `lib/turnstile-shared.ts`: fail-closed verification in development too; safe configuration/rejection diagnostics. No secret imported into browser code.
- `app/api/auth/{login,register}/route.ts`: structured 400 captcha failures, retaining frontend error code.
- `app/(auth)/signup/page.tsx`: redirects missing `/signup` alias to existing `/register`.
- `.env.example`, `README.md`: development configuration guidance, official local test pair, no automatic bypass.
- Auth/captcha tests: updated contracts; regression assertions for callback registration, 15-second CDN timeout, retry, development token gating, real Credentials session and missing/invalid challenges.

## Verification log

Commands run:

- `npx tsx --tsconfig tests/tsconfig.json --test --test-concurrency=1 tests/*.test.ts`: **140 passed, 0 failed**.
- `npx tsc --noEmit`: **passed**.
- Targeted ESLint for changed auth/captcha components, handlers and tests: **passed**.
- `git diff --check`: **passed**.

Acceptance evidence:

| Criterion | Result |
| --- | --- |
| Widget renders locally | Actual library tested in jsdom for login/register, SSR and Strict Mode; live iframe/challenge unverified. Development bypass removed. |
| Widget renders in production | Unverified: no deployment performed; browser and Cloudflare access required. |
| Successful token completes auth | Form submission, register API/database transaction and real Credentials session contracts pass using isolated database and mocked Siteverify; live provider/database/email journey unverified. |
| Missing site key displays config error | Passed SSR/client fallback tests; submit stays disabled; no key values displayed. |
| Blocked script errors within 15 seconds | Resource-error test and fake-clock unresponsive-CDN test pass; Retry replaces failed script; live DevTools simulation pending. |
| Missing/invalid tokens return 400 JSON | Login/register handler tests pass; Siteverify failure tests cover bad tokens, replays, network errors, aborts and malformed provider responses. |
| Happy path has no console errors/rejections | SSR/Strict Mode widget test captures no console errors; live browser console still needs checking. |

A full production build and live HTTP deployment contract suite were not run. Initial full-suite runs failed against obsolete bypass/403 expectations; updated those regression contracts and reran successfully. Dependencies were installed with scripts disabled; no production database or remote deployment was modified.

## Required deployment/operator checks

1. In Vercel Settings, securely set the matching server-only secret and public site key for Production, Preview and Development as appropriate. Never prefix the secret with `NEXT_PUBLIC_`. Set trusted server hostnames as well.
2. In Cloudflare, confirm this public value is the widget's **Site Key**, confirm the secret matches, select Managed mode, and review the allowed hostnames above. Do not broadly allow arbitrary preview hosts without review.
3. Rebuild/redeploy after changing public environment variables. In a browser on localhost and production, check `api.js` returns 200, iframe renders, verification produces a token, and login/signup complete with real test accounts. Registration continues to require the existing email verification policy.
4. Block `challenges.cloudflare.com` in DevTools: confirm error/Retry by 15 seconds, unblock and retry successfully. Confirm no happy-path console errors. Check server logs for safe rejection reasons if verification still fails.

No Cloudflare allowlist change, real token issuance, or production recovery is claimed by this patch alone.
