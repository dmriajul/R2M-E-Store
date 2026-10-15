-- ============================================================================
--  rollback_rls.sql — undo the RLS hardening (001–005)
-- ============================================================================
--
--  ⚠ ONLY RUN THIS IF THE MIGRATIONS CAUSE A PROBLEM YOU CANNOT FIX FORWARD.
--  Rolling back re-opens every table in `public` to the anonymous PostgREST
--  API — that is exactly the "RLS Disabled in Public" exposure the migrations
--  closed. Prefer fixing the offending policy instead.
--
--  This file deliberately lives OUTSIDE `supabase/migrations/`, so the
--  Supabase CLI (`supabase db push`) never applies it automatically. Paste it
--  into the SQL Editor only when you mean it.
--
--  Order: policies → column grants → RLS flags → helper functions.
--  Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. Drop every policy created by 003–005.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_select_own_or_super_admin"       ON public."User";
DROP POLICY IF EXISTS "user_update_super_admin"              ON public."User";

DROP POLICY IF EXISTS "address_select_own_or_staff"          ON public."Address";
DROP POLICY IF EXISTS "address_insert_own"                   ON public."Address";
DROP POLICY IF EXISTS "address_update_own"                   ON public."Address";
DROP POLICY IF EXISTS "address_delete_own"                   ON public."Address";

DROP POLICY IF EXISTS "wishlist_select_own"                  ON public."WishlistItem";
DROP POLICY IF EXISTS "wishlist_insert_own"                  ON public."WishlistItem";
DROP POLICY IF EXISTS "wishlist_update_own"                  ON public."WishlistItem";
DROP POLICY IF EXISTS "wishlist_delete_own"                  ON public."WishlistItem";

DROP POLICY IF EXISTS "order_select_own_or_support"          ON public."Order";
DROP POLICY IF EXISTS "order_update_support"                ON public."Order";
DROP POLICY IF EXISTS "order_update_staff"                  ON public."Order";

DROP POLICY IF EXISTS "order_item_select_own_or_staff"       ON public."OrderItem";

DROP POLICY IF EXISTS "return_select_own_or_support"         ON public."ReturnRequest";
DROP POLICY IF EXISTS "return_insert_own"                    ON public."ReturnRequest";
DROP POLICY IF EXISTS "return_update_support"                ON public."ReturnRequest";

DROP POLICY IF EXISTS "review_select_public"                 ON public."Review";
DROP POLICY IF EXISTS "review_insert_verified_buyer"         ON public."Review";
DROP POLICY IF EXISTS "review_update_own_author"             ON public."Review";
DROP POLICY IF EXISTS "review_delete_staff"                  ON public."Review";

DROP POLICY IF EXISTS "coupon_select_active_or_super_admin"  ON public."Coupon";
DROP POLICY IF EXISTS "coupon_insert_super_admin"            ON public."Coupon";
DROP POLICY IF EXISTS "coupon_update_super_admin"            ON public."Coupon";
DROP POLICY IF EXISTS "coupon_delete_super_admin"            ON public."Coupon";

DROP POLICY IF EXISTS "variant_select_public"                ON public."ProductVariant";
DROP POLICY IF EXISTS "variant_insert_staff"                 ON public."ProductVariant";
DROP POLICY IF EXISTS "variant_update_staff"                 ON public."ProductVariant";
DROP POLICY IF EXISTS "variant_delete_staff"                 ON public."ProductVariant";

DROP POLICY IF EXISTS "product_select_public"                ON public."Product";
DROP POLICY IF EXISTS "product_insert_staff"                 ON public."Product";
DROP POLICY IF EXISTS "product_update_staff"                 ON public."Product";
DROP POLICY IF EXISTS "product_delete_staff"                 ON public."Product";

DROP POLICY IF EXISTS "category_select_public"               ON public."Category";
DROP POLICY IF EXISTS "category_insert_staff"                ON public."Category";
DROP POLICY IF EXISTS "category_update_staff"                ON public."Category";
DROP POLICY IF EXISTS "category_delete_staff"                ON public."Category";

DROP POLICY IF EXISTS "site_settings_select_public"          ON public."SiteSettings";
DROP POLICY IF EXISTS "site_settings_insert_staff"           ON public."SiteSettings";
DROP POLICY IF EXISTS "site_settings_update_staff"           ON public."SiteSettings";
DROP POLICY IF EXISTS "site_settings_delete_staff"           ON public."SiteSettings";

-- ---------------------------------------------------------------------------
--  2. Restore the pre-migration column grants on "User" (Supabase's default
--     is ALL on the whole table for the API roles — that is what allowed
--     `password` hashes to leak; see 003 before you celebrate this part).
-- ---------------------------------------------------------------------------
GRANT ALL ON public."User" TO anon, authenticated;

-- ---------------------------------------------------------------------------
--  3. Switch RLS back off (restores the exact pre-migration state the
--     dashboard warned about).
-- ---------------------------------------------------------------------------
ALTER TABLE public."User"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Order"          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderItem"      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Address"        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."WishlistItem"   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Review"         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Coupon"         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProductVariant" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."ReturnRequest"  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Product"        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Category"       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."SiteSettings"   DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
--  4. Drop the helper functions.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.app_has_purchased_product(text);
DROP FUNCTION IF EXISTS public.app_owns_order_item(text);
DROP FUNCTION IF EXISTS public.app_owns_order(text);
DROP FUNCTION IF EXISTS public.app_is_support_or_above();
DROP FUNCTION IF EXISTS public.app_is_super_admin();
DROP FUNCTION IF EXISTS public.app_is_staff();
DROP FUNCTION IF EXISTS public.app_user_role();
DROP FUNCTION IF EXISTS public.app_current_user_id();

-- ============================================================================
--  Rolled back. Re-apply with supabase/migrations/001 … 005 when ready.
-- ============================================================================
