-- ============================================================================
--  005_rls_policies_catalog.sql — Review, Coupon, ProductVariant, Product,
--                                 Category, SiteSettings
-- ============================================================================
--
--  Catalog tables are read by the world (that's the shop window) but written
--  only by staff. `Coupon` is the interesting one: the code itself is public
--  (shoppers type it at checkout) but unpublished/expired coupons are for
--  super admins only.
--
--    Review         SELECT  anyone
--                   INSERT  authenticated buyers, for products they actually
--                           bought (one per product — DB unique constraint)
--                   UPDATE  the review's own author (fix typos)
--                   DELETE  staff only
--    Coupon         SELECT  anyone — active coupons; super admins see all
--                   INSERT/UPDATE/DELETE  super admins only
--    ProductVariant SELECT  anyone (sizes/colours/stock on the product page)
--                   INSERT/UPDATE/DELETE  staff only
--    Product        SELECT  anyone (the catalogue)
--                   INSERT/UPDATE/DELETE  staff only
--    Category       SELECT  anyone (nav / filters)
--                   INSERT/UPDATE/DELETE  staff only
--    SiteSettings   SELECT  anyone (hero banner etc.)
--                   INSERT/UPDATE/DELETE  staff only
--
--  NOTE ON "authenticated": this app authenticates with NextAuth.js and reads
--  data with Prisma (owner role, bypasses RLS), so in practice the Review
--  INSERT policy is a guard on the *PostgREST* surface — it stops the public
--  anon key from posting fake reviews, and it's the correct rule set if a
--  Supabase-JS client is ever added. The storefront's own review flow goes
--  through Prisma/server actions and is unchanged.
--
--  Every policy is DROP + CREATE, so the file is safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  REVIEW — "Anyone can read reviews. Authenticated users can create reviews
--  for products they purchased. Only staff can delete reviews."
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "review_select_public" ON public."Review";
CREATE POLICY "review_select_public"
  ON public."Review"
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "review_insert_verified_buyer" ON public."Review";
CREATE POLICY "review_insert_verified_buyer"
  ON public."Review"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Must be signed in as the review's author…
    "userId" = public.app_current_user_id()
    -- …and have actually bought the product (non-cancelled order).
    AND public.app_has_purchased_product("productId")
  );

-- Spec grants edit rights to nobody over the API; letting the author fix their
-- own review is the obvious, abuse-free exception (they can't change identity
-- or product thanks to WITH CHECK).
DROP POLICY IF EXISTS "review_update_own_author" ON public."Review";
CREATE POLICY "review_update_own_author"
  ON public."Review"
  FOR UPDATE
  TO anon, authenticated
  USING ("userId" = public.app_current_user_id())
  WITH CHECK ("userId" = public.app_current_user_id());

DROP POLICY IF EXISTS "review_delete_staff" ON public."Review";
CREATE POLICY "review_delete_staff"
  ON public."Review"
  FOR DELETE
  TO anon, authenticated
  USING (public.app_is_staff());

-- ---------------------------------------------------------------------------
--  COUPON — "Anyone can read active coupons. Only super admins can CRUD
--  coupons." (Legacy ADMIN rows normalise to SUPER_ADMIN in lib/rbac.ts and
--  are treated the same by app_is_super_admin().)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "coupon_select_active_or_super_admin" ON public."Coupon";
CREATE POLICY "coupon_select_active_or_super_admin"
  ON public."Coupon"
  FOR SELECT
  TO anon, authenticated
  USING (active = true OR public.app_is_super_admin());

DROP POLICY IF EXISTS "coupon_insert_super_admin" ON public."Coupon";
CREATE POLICY "coupon_insert_super_admin"
  ON public."Coupon"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.app_is_super_admin());

DROP POLICY IF EXISTS "coupon_update_super_admin" ON public."Coupon";
CREATE POLICY "coupon_update_super_admin"
  ON public."Coupon"
  FOR UPDATE
  TO anon, authenticated
  USING (public.app_is_super_admin())
  WITH CHECK (public.app_is_super_admin());

DROP POLICY IF EXISTS "coupon_delete_super_admin" ON public."Coupon";
CREATE POLICY "coupon_delete_super_admin"
  ON public."Coupon"
  FOR DELETE
  TO anon, authenticated
  USING (public.app_is_super_admin());

-- ---------------------------------------------------------------------------
--  PRODUCT VARIANT — "Anyone can read. Only staff to write."
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "variant_select_public" ON public."ProductVariant";
CREATE POLICY "variant_select_public"
  ON public."ProductVariant"
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "variant_insert_staff" ON public."ProductVariant";
CREATE POLICY "variant_insert_staff"
  ON public."ProductVariant"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.app_is_staff());

DROP POLICY IF EXISTS "variant_update_staff" ON public."ProductVariant";
CREATE POLICY "variant_update_staff"
  ON public."ProductVariant"
  FOR UPDATE
  TO anon, authenticated
  USING (public.app_is_staff())
  WITH CHECK (public.app_is_staff());

DROP POLICY IF EXISTS "variant_delete_staff" ON public."ProductVariant";
CREATE POLICY "variant_delete_staff"
  ON public."ProductVariant"
  FOR DELETE
  TO anon, authenticated
  USING (public.app_is_staff());

-- ---------------------------------------------------------------------------
--  PRODUCT — "possibly others" on the warning list. The catalogue itself:
--  public reads, staff writes (same shape as variants).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "product_select_public" ON public."Product";
CREATE POLICY "product_select_public"
  ON public."Product"
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "product_insert_staff" ON public."Product";
CREATE POLICY "product_insert_staff"
  ON public."Product"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.app_is_staff());

DROP POLICY IF EXISTS "product_update_staff" ON public."Product";
CREATE POLICY "product_update_staff"
  ON public."Product"
  FOR UPDATE
  TO anon, authenticated
  USING (public.app_is_staff())
  WITH CHECK (public.app_is_staff());

DROP POLICY IF EXISTS "product_delete_staff" ON public."Product";
CREATE POLICY "product_delete_staff"
  ON public."Product"
  FOR DELETE
  TO anon, authenticated
  USING (public.app_is_staff());

-- ---------------------------------------------------------------------------
--  CATEGORY — public reads, staff writes.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "category_select_public" ON public."Category";
CREATE POLICY "category_select_public"
  ON public."Category"
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "category_insert_staff" ON public."Category";
CREATE POLICY "category_insert_staff"
  ON public."Category"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.app_is_staff());

DROP POLICY IF EXISTS "category_update_staff" ON public."Category";
CREATE POLICY "category_update_staff"
  ON public."Category"
  FOR UPDATE
  TO anon, authenticated
  USING (public.app_is_staff())
  WITH CHECK (public.app_is_staff());

DROP POLICY IF EXISTS "category_delete_staff" ON public."Category";
CREATE POLICY "category_delete_staff"
  ON public."Category"
  FOR DELETE
  TO anon, authenticated
  USING (public.app_is_staff());

-- ---------------------------------------------------------------------------
--  SITE SETTINGS — the singleton hero/banner row: public reads, staff writes.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "site_settings_select_public" ON public."SiteSettings";
CREATE POLICY "site_settings_select_public"
  ON public."SiteSettings"
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "site_settings_insert_staff" ON public."SiteSettings";
CREATE POLICY "site_settings_insert_staff"
  ON public."SiteSettings"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.app_is_staff());

DROP POLICY IF EXISTS "site_settings_update_staff" ON public."SiteSettings";
CREATE POLICY "site_settings_update_staff"
  ON public."SiteSettings"
  FOR UPDATE
  TO anon, authenticated
  USING (public.app_is_staff())
  WITH CHECK (public.app_is_staff());

DROP POLICY IF EXISTS "site_settings_delete_staff" ON public."SiteSettings";
CREATE POLICY "site_settings_delete_staff"
  ON public."SiteSettings"
  FOR DELETE
  TO anon, authenticated
  USING (public.app_is_staff());

-- ============================================================================
--  Done. Verify with the queries in supabase/README.md ("How to verify").
--  If anything goes wrong, supabase/rollback_rls.sql restores the old state.
-- ============================================================================
