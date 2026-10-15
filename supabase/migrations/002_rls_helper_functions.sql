-- ============================================================================
--  002_rls_helper_functions.sql — role & ownership helpers for the RLS policies
-- ============================================================================
--
--  The policies in 003–005 call the small, auditable functions below instead of
--  inlining subqueries everywhere. Two design points matter:
--
--  1. NextAuth, not Supabase Auth.
--     This app signs users in with NextAuth.js (credentials + bcrypt) and reads
--     data with Prisma. PostgREST therefore NEVER carries a per-user Supabase
--     JWT in production — and the functions are written for exactly that:
--
--       * `app_current_user_id()` reads the caller id from the PostgREST JWT
--         claims GUC (`request.jwt.claims`), and returns NULL when there is no
--         JWT. Every "own row" policy compares against it, so anonymous API
--         calls can never match an owner — deny by default.
--       * The NextAuth application is unaffected: Prisma connects as the table
--         OWNER (`postgres`, the role that ran `prisma db push`), and owners
--         bypass RLS entirely. Enabling RLS + these policies cannot change what
--         the storefront or admin panel return.
--
--  2. SECURITY DEFINER on the lookups that read `public."User"` / `"Order"` /
--     `"OrderItem"`. Those tables have RLS of their own; a policy subquery that
--     read them as the calling role would recurse (and see zero rows). Running
--     the lookup as the function owner sidesteps the recursion. Every function
--     pins `search_path` so a hostile schema cannot shadow them.
--
--  Role vocabulary mirrors `lib/rbac.ts`:
--
--       ADMIN  ............ legacy alias, read as SUPER_ADMIN (normalizeRole)
--       SUPER_ADMIN ....... everything
--       INVENTORY_MANAGER . products, categories
--       SEO_MANAGER ....... product metadata, settings
--       SUPPORT_MANAGER ... orders, returns, customers
--       CUSTOMER .......... storefront only
--
--  "staff"  = any console role (isStaff() in lib/rbac.ts)
--  "super admin" = SUPER_ADMIN or its legacy ADMIN spelling
--  "support or above" = SUPER_ADMIN / ADMIN / SUPPORT_MANAGER — the roles the
--                       app's PERMISSION_ROLES matrix gives orders & returns.
--
--  Safe to re-run: `CREATE OR REPLACE` everywhere.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  PostgREST API roles. Supabase already defines these; on a plain Postgres
--  (local test rig, self-hosted) create them so the grants and policies below
--  can run unchanged. NOLOGIN — they only exist as policy subjects.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
--  app_current_user_id() — who is calling over the PostgREST API?
--  Text (not uuid) on purpose: User.id values are cuid() strings.
--  NULL for anonymous calls, and NULL for every Prisma/owner connection
--  (owners never evaluate policies anyway).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_current_user_id()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims text;
  sub    text;
BEGIN
  -- Modern PostgREST: one JSON claims GUC.
  claims := current_setting('request.jwt.claims', true);
  IF claims IS NOT NULL AND claims <> '' THEN
    BEGIN
      sub := claims::jsonb ->> 'sub';
    EXCEPTION WHEN OTHERS THEN
      sub := NULL; -- not JSON — fall through to the legacy GUC below
    END;
  END IF;

  -- Legacy PostgREST / GoTrue: individual claim GUCs.
  IF sub IS NULL OR sub = '' THEN
    sub := NULLIF(current_setting('request.jwt.claim.sub', true), '');
  END IF;

  RETURN sub;
END;
$$;

COMMENT ON FUNCTION public.app_current_user_id() IS
  'Caller id from the PostgREST JWT claims (text cuid). NULL for anon / no JWT.';

-- ---------------------------------------------------------------------------
--  app_user_role() — the console role of the calling user, or NULL.
--  SECURITY DEFINER: must be able to read public."User" without tripping that
--  table''s own RLS (which would make every policy recurse into itself).
--  Trashed accounts (deletedAt set) resolve to NULL — they are not staff.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.role::text
  FROM public."User" u
  WHERE u.id = public.app_current_user_id()
    AND u."deletedAt" IS NULL
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.app_user_role() IS
  'Role of the current PostgREST caller, read from public."User" (SECURITY DEFINER). NULL when unknown or trashed.';

-- ---------------------------------------------------------------------------
--  Staff predicates — one place that defines "staff", "super admin" and
--  "support or above", mirroring lib/rbac.ts (legacy ADMIN ≡ SUPER_ADMIN).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    public.app_user_role() IN (
      'ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER', 'SEO_MANAGER', 'SUPPORT_MANAGER'
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.app_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(public.app_user_role() IN ('ADMIN', 'SUPER_ADMIN'), false);
$$;

CREATE OR REPLACE FUNCTION public.app_is_support_or_above()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    public.app_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'),
    false
  );
$$;

-- ---------------------------------------------------------------------------
--  Ownership lookups (SECURITY DEFINER — see note at the top).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_owns_order(order_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT o."userId" = public.app_current_user_id()
      FROM public."Order" o
      WHERE o.id = order_id
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.app_owns_order(text) IS
  'True when the current PostgREST caller owns the given order.';

CREATE OR REPLACE FUNCTION public.app_owns_order_item(order_item_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT o."userId" = public.app_current_user_id()
      FROM public."OrderItem" oi
      JOIN public."Order" o ON o.id = oi."orderId"
      WHERE oi.id = order_item_id
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.app_owns_order_item(text) IS
  'True when the current PostgREST caller owns the order the given line item belongs to.';

CREATE OR REPLACE FUNCTION public.app_has_purchased_product(product_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT true
      FROM public."OrderItem" oi
      JOIN public."Order" o ON o.id = oi."orderId"
      WHERE o."userId" = public.app_current_user_id()
        AND oi."productId" = product_id
        AND o.status::text <> 'CANCELLED'
      LIMIT 1
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.app_has_purchased_product(text) IS
  'True when the current PostgREST caller has bought the given product on a non-cancelled order (review gate).';

-- ---------------------------------------------------------------------------
--  These helpers are read-only building blocks for policies. `anon` and
--  `authenticated` must be able to EXECUTE them (policies run as the caller);
--  everything else is revoked. The function owner (the `postgres` role that
--  runs this migration) keeps full control as owner.
--
--  The grants are conditional so this file also runs on a plain Postgres (or a
--  local test rig) where the Supabase API roles do not exist.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.app_current_user_id()             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_user_role()                   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_is_staff()                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_is_super_admin()              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_is_support_or_above()         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_owns_order(text)              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_owns_order_item(text)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_has_purchased_product(text)   FROM PUBLIC;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.app_current_user_id() TO %I', r);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.app_user_role() TO %I', r);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.app_is_staff() TO %I', r);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.app_is_super_admin() TO %I', r);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.app_is_support_or_above() TO %I', r);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.app_owns_order(text) TO %I', r);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.app_owns_order_item(text) TO %I', r);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.app_has_purchased_product(text) TO %I', r);
    END IF;
  END LOOP;
END
$$;

-- ============================================================================
--  Next: 003_rls_policies_accounts.sql
-- ============================================================================
