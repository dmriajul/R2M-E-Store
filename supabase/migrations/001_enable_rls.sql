-- ============================================================================
--  001_enable_rls.sql — turn Row Level Security ON for every public table
-- ============================================================================
--
--  WHY: Supabase exposes the `public` schema over PostgREST (the auto-generated
--  REST API). Any table in `public` WITHOUT RLS is fully readable — and often
--  writable — by anyone holding the public `anon` API key. That is what the
--  "RLS Disabled in Public" critical warnings in the Supabase dashboard are
--  telling you: `User`, `Order`, `OrderItem`, `Address`, `WishlistItem`,
--  `Review`, `Coupon`, `ProductVariant`, `ReturnRequest` & co. are currently
--  open to the world through that API.
--
--  Enabling RLS does NOT touch your Next.js app:
--
--    * The app talks to Postgres through Prisma (`DATABASE_URL`) using the
--      `postgres` role — the role that ran `prisma db push` and therefore the
--      OWNER of every table. Table owners BYPASS Row Level Security, so every
--      storefront page, Server Action and admin-panel query keeps working
--      exactly as before.
--    * Only the PostgREST API roles (`anon`, `authenticated`) — the surface the
--      dashboard is warning about — become subject to the policies that
--      003–005 install.
--
--  With RLS enabled and NO policies yet, `anon`/`authenticated` can already see
--  NOTHING (deny by default). Files 003–005 then re-open just the rows each
--  audience is allowed to see.
--
--  Safe to re-run: `ENABLE ROW LEVEL SECURITY` is idempotent.
--
--  ⚠ Do NOT add `FORCE ROW LEVEL SECURITY`. Forcing would apply the policies to
--    the owner role too and would break Prisma queries. The owner must keep its
--    bypass so the NextAuth + Prisma application is unaffected.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  The tables named in the dashboard warning (Prisma model name = table name,
--  so they are mixed-case and must be quoted).
-- ---------------------------------------------------------------------------

ALTER TABLE public."User"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Order"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderItem"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Address"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WishlistItem"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Review"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Coupon"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProductVariant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ReturnRequest"  ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
--  The remaining public tables ("possibly others" on the warning list).
--  The storefront reads these over Prisma/owner, so nothing changes for the
--  site; this just stops PostgREST from serving them unprotected.
-- ---------------------------------------------------------------------------

ALTER TABLE public."Product"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Category"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SiteSettings"  ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
--  Safety net: switch RLS on for ANY other table someone later adds to the
--  `public` schema (new Prisma models, one-off scratch tables, …), so a new
--  table can never re-trigger the warning or ship unprotected. A table with
--  RLS on and no policies is invisible to `anon`/`authenticated` — add policies
--  in a follow-up migration before exposing it deliberately.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    RAISE NOTICE 'RLS enabled on public.%', t.relname;
  END LOOP;
END
$$;

-- ============================================================================
--  Next: 002_rls_helper_functions.sql   (role helpers the policies call)
--        003_rls_policies_accounts.sql  (User, Address, WishlistItem)
--        004_rls_policies_orders.sql    (Order, OrderItem, ReturnRequest)
--        005_rls_policies_catalog.sql   (Review, Coupon, ProductVariant, …)
-- ============================================================================
