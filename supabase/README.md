# Database security — Supabase Row Level Security (RLS)

This folder hardens the Supabase Postgres database behind Mukra against the
**“RLS Disabled in Public”** critical warnings in the Supabase dashboard
(`User`, `Order`, `OrderItem`, `Address`, `WishlistItem`, `Review`, `Coupon`,
`ProductVariant`, `ReturnRequest`, `Product`, `Category`, `SiteSettings`).

---

## 1. What is RLS, and why does it matter?

**Row Level Security** is a Postgres feature: once a table has RLS enabled,
every query against it is filtered through *policies* — SQL predicates that say
which rows the current role may `SELECT`, `INSERT`, `UPDATE` or `DELETE`.

Why it matters here, specifically:

- **Supabase exposes your `public` schema over PostgREST** — a ready-made REST
  API reachable at `https://<project-ref>.supabase.co/rest/v1/...` with the
  project's public `anon` API key (the `NEXT_PUBLIC_SUPABASE_ANON_KEY` — it is
  *designed* to be shipped in browsers; it is not a secret).
- **A table in `public` without RLS is fully open on that API.** With the anon
  key alone, anyone could `GET /rest/v1/Order?select=*` and read every order,
  address and phone number in your database — or write rows. That is exactly
  what the dashboard warning means by “RLS Disabled in Public”.
- **RLS is deny-by-default.** With RLS on and no policies, an API role sees
  *zero* rows. Policies then re-open exactly what each audience needs — and
  nothing more.

The storefront never uses PostgREST — it talks to Postgres through Prisma —
so this hardening closes a door your app doesn't use, without touching a single
query the app makes.

---

## 2. How this works with NextAuth.js + Prisma (why nothing breaks)

The critical question: *if RLS restricts access, how do the storefront and
admin panel keep working?* They authenticate with **NextAuth.js** (credentials
+ bcrypt JWTs), not Supabase Auth — there is no Supabase user/JWT per request.

The answer is Postgres roles:

| Path into the database | Role used | RLS applies? |
| --- | --- | --- |
| Next.js app → Prisma (`DATABASE_URL` / `DIRECT_URL`) | `postgres` — the role that ran `prisma db push`, i.e. the **table owner** | **No — owners bypass RLS** |
| Browser / attacker → PostgREST (`/rest/v1/...`, anon key) | `anon`, `authenticated` | **Yes — these the policies govern** |
| Supabase internal services | `service_role` | No (`BYPASSRLS`) |

So:

- **Every existing feature keeps working unchanged.** Cart, checkout, orders,
  admin panel, RBAC-gated Server Actions, seeding, `prisma db push` — all run
  through Prisma as the owner and bypass RLS entirely. The app's authorization
  stays where it always was: `lib/rbac.ts`, `middleware.ts` and the Server
  Actions.
- **The policies are written in terms of `auth.uid()`-style JWT claims**
  (`public.app_current_user_id()` reads the PostgREST JWT claims, and returns
  `NULL` when there is none). Because the app never sends a Supabase JWT, the
  “own rows only” rules simply never match for the public API — which is
  exactly right: the anonymous public API should see nothing personal. If you
  ever add a Supabase-JS client (or Supabase Auth), the same policies light up
  and enforce “users see their own rows / staff see more” per user.
- **Staff roles mirror `lib/rbac.ts`**: `ADMIN` (the legacy spelling) is read
  as `SUPER_ADMIN`, “staff” means any console role, “support and above” means
  `SUPPORT_MANAGER` + `SUPER_ADMIN`.

> ⚠ **Do NOT add `FORCE ROW LEVEL SECURITY`** to these tables. Forcing applies
> policies to the owner too, Prisma would suddenly be subject to them, and the
> app would break. Owner bypass is the contract that keeps everything working.

### If your `DATABASE_URL` is *not* the owner role

The table owner is whichever role ran `prisma db push` (normally `postgres`).
If you connect Prisma with a different, non-owner role, RLS **will** apply to
the app and queries will return fewer rows. Fix: point `DATABASE_URL` /
`DIRECT_URL` at the owner (`postgres`) connection strings from
Supabase → Project Settings → Database, which is what
`.env.example` already recommends.

---

## 3. What's in these files

| File | What it does |
| --- | --- |
| `migrations/001_enable_rls.sql` | Turns RLS **on** for every table in `public` (the 9 warned tables + `Product`, `Category`, `SiteSettings`, plus a safety net for any future table) |
| `migrations/002_rls_helper_functions.sql` | Small `SECURITY DEFINER` helpers the policies call: `app_current_user_id()`, `app_user_role()`, `app_is_staff()`, `app_is_super_admin()`, `app_is_support_or_above()`, `app_owns_order()`, `app_owns_order_item()`, `app_has_purchased_product()` |
| `migrations/003_rls_policies_accounts.sql` | `User`, `Address`, `WishlistItem` — plus column-level grants that keep the bcrypt `password` hash out of PostgREST forever |
| `migrations/004_rls_policies_orders.sql` | `Order`, `OrderItem`, `ReturnRequest` |
| `migrations/005_rls_policies_catalog.sql` | `Review`, `Coupon`, `ProductVariant`, `Product`, `Category`, `SiteSettings` |
| `tests/rls.test.mjs` | Offline test rig (PGlite) that applies the migrations to a throwaway Postgres and asserts the policy matrix below |
| `rollback_rls.sql` | Undo everything (kept **outside** `migrations/` so it can never auto-run) |

All migration files are **idempotent** — running one twice is harmless.

### Policy matrix (PostgREST surface only)

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `User` | own profile, or super admin | — (server-side) | super admin (never `password`) | — never via client |
| `Order` | own orders, or support & above | — (checkout, server-side) | support & above (order status) | — never via API |
| `OrderItem` | own order's items, or staff | — | — (immutable) | — |
| `Address` | own, or staff (shipping) | own | own | own |
| `WishlistItem` | own | own | own | own |
| `Review` | anyone | verified buyers only (bought the product) | own author | staff |
| `Coupon` | anyone (active only); super admin sees all | super admin | super admin | super admin |
| `ProductVariant` | anyone | staff | staff | staff |
| `Product` | anyone | staff | staff | staff |
| `Category` | anyone | staff | staff | staff |
| `SiteSettings` | anyone | staff | staff | staff |
| `ReturnRequest` | own, or support & above | own (own order + item) | support & above | — never via API |

“own” = the row's `userId` equals the caller id from the PostgREST JWT
(`app_current_user_id()`). “staff” = any console role
(`SUPER_ADMIN` / `INVENTORY_MANAGER` / `SEO_MANAGER` / `SUPPORT_MANAGER` /
legacy `ADMIN`). “support & above” = `SUPPORT_MANAGER` + `SUPER_ADMIN`.

> **Order updates — why support & above, not “any staff”?** Postgres cannot
> update rows the caller cannot see (the SELECT policy gates the scan), and the
> read rule deliberately hides orders from SEO/inventory managers. So “only
> staff can update order status” resolves to the order staff who can see the
> row — exactly `PERMISSION_ROLES["orders:write"]` (`SUPER_ADMIN` +
> `SUPPORT_MANAGER`) in `lib/rbac.ts`.

---

## 4. How to apply the migrations (Supabase SQL Editor)

You need the migrations to run **in order, as the `postgres` role** (the SQL
Editor already runs as `postgres`).

1. Open your project at <https://supabase.com/dashboard> and go to
   **SQL Editor** in the left sidebar.
2. Click **New query** (or `+ New snippet`).
3. Open `supabase/migrations/001_enable_rls.sql` in your editor, copy the whole
   file, paste it into the SQL Editor.
4. Click **Run** (or press `Ctrl/Cmd + Enter`). You should see
   `Success. No rows returned` — plus any `RLS enabled on public.x` notices.
5. Repeat steps 2–4 for the remaining files **in this exact order**:
   1. `001_enable_rls.sql`
   2. `002_rls_helper_functions.sql`
   3. `003_rls_policies_accounts.sql`
   4. `004_rls_policies_orders.sql`
   5. `005_rls_policies_catalog.sql`
6. Done. The dashboard's **Authentication → Policies** (or Table Editor →
   the shield icon) now shows RLS enabled with policies for every table, and
   the Security Advisor warnings disappear.

> **Using the Supabase CLI instead?** The files live in the standard
> `supabase/migrations/` layout, so `supabase link --project-ref <ref>` +
> `supabase db push` applies them in the same order automatically.

---

## 5. How to verify RLS is working

### 5a. SQL checks (run in the SQL Editor)

Every table in `public` has RLS on:

```sql
SELECT c.relname AS table,
       c.relrowsecurity AS rls_enabled,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
```

Expected: `rls_enabled = t` for every table; the twelve tables above carry
1–4 policies each.

The policies themselves:

```sql
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

The `password` hash is no longer readable over PostgREST (column grants):

```sql
-- Should list only the safe columns — no `password`.
SELECT column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'User'
  AND grantee IN ('anon', 'authenticated') AND privilege_type = 'SELECT'
ORDER BY column_name;
```

### 5b. PostgREST checks (the actual attack path)

Replace `<project-ref>` and `<anon-key>` (Dashboard → Project Settings →
API). These commands prove the public API is locked down **and** that the
public catalogue still serves:

```bash
# Was: every order in the store. Must now return []
curl "https://<project-ref>.supabase.co/rest/v1/Order?select=*" \
  -H "apikey: <anon-key>"

# Was: every user incl. bcrypt hashes. Must now return []
curl "https://<project-ref>.supabase.co/rest/v1/User?select=*" \
  -H "apikey: <anon-key>"

# Was: every address/phone number. Must now return []
curl "https://<project-ref>.supabase.co/rest/v1/Address?select=*" \
  -H "apikey: <anon-key>"

# Should still return the catalogue (public by design)
curl "https://<project-ref>.supabase.co/rest/v1/Product?select=id,name,price&limit=3" \
  -H "apikey: <anon-key>"

# Active coupons only — create an inactive coupon and confirm it's invisible
curl "https://<project-ref>.supabase.co/rest/v1/Coupon?select=code,active" \
  -H "apikey: <anon-key>"
```

A write attempt must be rejected too:

```bash
# Must return 403 (new row violates policy) or 401
curl -X POST "https://<project-ref>.supabase.co/rest/v1/Review" \
  -H "apikey: <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"fake","productId":"fake","rating":5,"comment":"spam"}'
```

### 5c. App-level smoke test (admin panel + storefront)

RLS does not apply to Prisma, but verify nothing regressed anyway:

1. `npm run dev`, sign in as `admin@mukra.com` / `password123` (or your real
   super admin).
2. Storefront: home → product list → product detail → add to cart → wishlist →
   submit a review.
3. Account area: addresses (add/edit/delete), orders list + detail, returns.
4. Admin: dashboard KPIs, products CRUD, orders (change a status), returns
   (approve/reject), coupons CRUD, categories, customers, staff & roles.
5. `GET /api/health` reports the database available.

If all five pass, the app is unaffected — as designed.

### 5d. Offline policy tests

`tests/rls.test.mjs` applies the schema + migrations to a throwaway in-memory
Postgres (PGlite) and asserts the whole matrix — anon sees zero personal rows,
owners see everything, buyers can review only purchased products, and so on:

```bash
npm i --no-save @electric-sql/pglite   # one-off, not added to package.json
node supabase/tests/rls.test.mjs
```

---

## 6. Rollback (if you ever need it)

1. Open `supabase/rollback_rls.sql` (repo root of this folder — **not** in
   `migrations/`, so it never runs automatically).
2. SQL Editor → **New query** → paste the whole file → **Run**.
3. That drops every policy from 003–005, restores the old `User` grants,
   switches RLS off and removes the helper functions — the exact pre-migration
   state (including the dashboard warnings).
4. Re-apply later by running `001` … `005` again.

**Prefer fixing forward.** A policy that's too strict can be relaxed by editing
one `USING (...)` expression and re-running just that file — rolling back
re-opens order/address/user data to the entire internet.

---

## 7. Gotchas & maintenance

- **`prisma db push` recreating a table drops its policies.** If `db push`
  drops and re-creates a table (a column type change can do this), the new
  table starts with no policies and the warning returns. Re-run `001`–`005`
  (they're idempotent) after any destructive `db push`. The `001` safety-net
  block re-enables RLS on any new table automatically.
- **New Prisma models** get RLS from the `001` safety net (locked down, zero
  policies) — add a policy file for them before exposing anything deliberately.
- **Never `FORCE ROW LEVEL SECURITY`** — see section 2.
- **Trashed accounts** (`deletedAt` set) resolve to “no role”: their JWT can
  still match “own row” policies, but staff predicates reject them, mirroring
  the app (`normalizeRole` + sign-in guard).
- **`service_role`** keeps full, bypassing access for server-side jobs — the
  same escape hatch Supabase itself uses. It is a secret; never ship it to a
  browser.
- **Testing locally with `pglite`** requires nothing but Node 20+; the test
  creates the `anon`/`authenticated` roles itself on a plain Postgres.
