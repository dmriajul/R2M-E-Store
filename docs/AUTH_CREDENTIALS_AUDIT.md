# Authentication credentials audit

## Findings (2026-10-23)

- No hardcoded default master or customer login exists. `lib/demo-mode.ts` was
  removed before this audit; it has not been restored.
- The original `prisma/seed.ts` only bootstrapped a SUPER_ADMIN from `ADMIN_NAME`,
  `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. Both committed environment templates had
  no configured account credentials. There was no local env file or database
  URL supplied to this session. Existing database accounts therefore **cannot
  be inventoried or confirmed here**.
- `admin@mukra.com` / `password123` occurs in isolated tests, not a working
  fallback login. Login accepts a legacy password of that form if the matching
  bcrypt hash exists; newly seeded/registered accounts require stronger passwords.
- There is no AUTHOR enum. As agreed, the master author is SUPER_ADMIN. Other
  console roles are INVENTORY_MANAGER, SEO_MANAGER and SUPPORT_MANAGER;
  legacy ADMIN normalizes to SUPER_ADMIN. Registration always creates CUSTOMER
  and ignores client-supplied staff roles.

## Configure your testing accounts privately

Put these values in ignored `.env.local`, using your own strong passwords:

```dotenv
ADMIN_NAME="Master Author"
ADMIN_EMAIL="admin@mukra.com"
ADMIN_PASSWORD="<your private strong admin password>"
SEED_TEST_CUSTOMER_EMAIL="customer@mukra.com"
SEED_TEST_CUSTOMER_PASSWORD="<your private strong customer password>"
```

These are proposed account addresses, **not confirmed existing accounts**.
The master testing password is your `ADMIN_PASSWORD`; the customer testing
password is your `SEED_TEST_CUSTOMER_PASSWORD`. No fixed password is shipped.
Passwords require 8+ characters, uppercase, lowercase, number and special
character, with at most 72 UTF-8 bytes. Do not use these accounts on production.
Set DATABASE_URL to a PostgreSQL database you own and configure AUTH_SECRET,
local origin and Turnstile using `.env.example`. Never share connection strings.

```bash
npx prisma generate
# ONLY on an authorized development database; review schema changes first:
npm run db:push
npx prisma db seed
npm run auth:accounts
# Only in a private local terminal, to display environment passwords:
npm run auth:accounts -- --show-passwords
npm run dev
```

The new `prisma.config.ts` wires the seed and loads `.env.local` for CLI commands.
Shell variables take priority, then `.env.local`, then `.env`. The console
report is read-only, masks passwords by default and never selects database
password hashes. Displayed passwords are environment inputs, not proof that
those passwords currently authenticate. Production always masks them.

Seed reruns preserve existing password hashes. A mismatch fails rather than
resetting a password or claiming the new input works. Trashed accounts require
explicit restoration. The optional customer is verified on **creation** and is
refused under NODE_ENV=production. It cannot demote staff. Admin/customer emails
must differ. Existing customers retain their verification state.

## Login and additional authors

1. Open `/login`, complete Turnstile, and use your configured admin credentials.
   Open `/admin` for the console. For a customer use `/dashboard`.
2. Register another person at `/register`. The API hashes passwords with bcrypt
   (10 rounds) and atomically writes the CUSTOMER and verification-token digest.
3. Complete customer email verification. Locally, `DEBUG_VERIFICATION_EMAILS=true`
   prints verification links to the private server console when mail is absent.
4. As SUPER_ADMIN, open `/admin/staff` and grant the appropriate console role.
   Sign out/in as that person to refresh JWT role permissions.

## Verification results

- `npm test`: **142 passed, zero failed**, including new seed bcrypt, idempotence,
  mismatch and staff-demotion checks plus existing registration/login contracts.
  These use the repository's **test database double**, not live PostgreSQL.
- `npx next build`: **passed**, including TypeScript checks. This is separate
  from Prisma generation; an ungenerated Prisma placeholder is not a live client.
- `npm run build`: **blocked**, because its initial `prisma generate` cannot
  download engines from `binaries.prisma.sh` under this sandbox's network policy.
  Zero-error completion of the requested full command is **not confirmed**.
- Live seeding and real database persistence/login were not performed: no real
  database is configured, as agreed. Run the commands above from a network with
  Prisma engine access against an authorized dev database to complete that proof.
