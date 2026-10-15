-- ============================================================================
--  003_rls_policies_accounts.sql — User, Address, WishlistItem
-- ============================================================================
--
--  Who can see what, over the PostgREST API (`anon` / `authenticated` roles).
--  The NextAuth + Prisma app connects as the table owner and bypasses RLS, so
--  none of these rules change what the storefront or admin panel render.
--
--  Every policy is DROP + CREATE, so the file is safe to re-run.
--
--  Matrix (✔ = allowed, ✖ = denied by having no policy / failing USING):
--
--    User           SELECT  own profile, or super admin (legacy ADMIN ≡ SUPER_ADMIN)
--                   UPDATE  super admin only (role management) — never `password`
--                   INSERT  ✖  accounts are created server-side by the app
--                   DELETE  ✖  nobody deletes users over the API (use the app's
--                              Staff & Roles trash flow via Prisma)
--    Address        SELECT  own rows, or staff (support needs them for shipping)
--                   INSERT  own rows only ("userId" must be the caller)
--                   UPDATE  own rows only
--                   DELETE  own rows only
--    WishlistItem   ALL     own rows only
-- ============================================================================

-- ---------------------------------------------------------------------------
--  USER — "Users can read their own profile. Super admins can read/update all
--  users. No one can delete users via client."
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "user_select_own_or_super_admin" ON public."User";
CREATE POLICY "user_select_own_or_super_admin"
  ON public."User"
  FOR SELECT
  TO anon, authenticated
  USING (
    id = public.app_current_user_id()
    OR public.app_is_super_admin()
  );

DROP POLICY IF EXISTS "user_update_super_admin" ON public."User";
CREATE POLICY "user_update_super_admin"
  ON public."User"
  FOR UPDATE
  TO anon, authenticated
  USING (public.app_is_super_admin())
  WITH CHECK (public.app_is_super_admin());

-- No INSERT policy: registration and seeding happen server-side (NextAuth
-- credentials flow writes through Prisma as the owner role).
-- No DELETE policy: "no one can delete users via client" — a missing policy is
-- an explicit, total deny for anon/authenticated. The app's soft-delete (trash)
-- and purge flows run through Prisma and are unaffected.

-- ---------------------------------------------------------------------------
--  USER column lockdown — `password` holds the bcrypt hash and must never
--  leave the database over PostgREST, even for the account owner or a super
--  admin. Column-level grants win over `SELECT *`: PostgREST silently narrows
--  to the granted columns.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public."User" FROM anon, authenticated;

GRANT SELECT (
  id, name, email, phone, role, avatar,
  "deletedAt", "deletedById", "createdAt", "updatedAt"
) ON public."User" TO anon, authenticated;

-- UPDATE is limited to the profile/role columns a super admin manages; the
-- password (bcrypt, set only by the app's credential flows), the id and the
-- timestamps are not updatable over the API.
GRANT UPDATE (
  name, email, phone, role, avatar, "deletedAt", "deletedById"
) ON public."User" TO anon, authenticated;

-- ---------------------------------------------------------------------------
--  ADDRESS — "Users can CRUD their own addresses. Staff can read all
--  addresses (for shipping)."
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "address_select_own_or_staff" ON public."Address";
CREATE POLICY "address_select_own_or_staff"
  ON public."Address"
  FOR SELECT
  TO anon, authenticated
  USING (
    "userId" = public.app_current_user_id()
    OR public.app_is_staff()
  );

DROP POLICY IF EXISTS "address_insert_own" ON public."Address";
CREATE POLICY "address_insert_own"
  ON public."Address"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK ("userId" = public.app_current_user_id());

DROP POLICY IF EXISTS "address_update_own" ON public."Address";
CREATE POLICY "address_update_own"
  ON public."Address"
  FOR UPDATE
  TO anon, authenticated
  USING ("userId" = public.app_current_user_id())
  WITH CHECK ("userId" = public.app_current_user_id());

DROP POLICY IF EXISTS "address_delete_own" ON public."Address";
CREATE POLICY "address_delete_own"
  ON public."Address"
  FOR DELETE
  TO anon, authenticated
  USING ("userId" = public.app_current_user_id());

-- ---------------------------------------------------------------------------
--  WISHLIST ITEM — "Users can CRUD their own wishlist items." Nothing else:
--  a wishlist is private, staff included.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "wishlist_select_own" ON public."WishlistItem";
CREATE POLICY "wishlist_select_own"
  ON public."WishlistItem"
  FOR SELECT
  TO anon, authenticated
  USING ("userId" = public.app_current_user_id());

DROP POLICY IF EXISTS "wishlist_insert_own" ON public."WishlistItem";
CREATE POLICY "wishlist_insert_own"
  ON public."WishlistItem"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK ("userId" = public.app_current_user_id());

DROP POLICY IF EXISTS "wishlist_update_own" ON public."WishlistItem";
CREATE POLICY "wishlist_update_own"
  ON public."WishlistItem"
  FOR UPDATE
  TO anon, authenticated
  USING ("userId" = public.app_current_user_id())
  WITH CHECK ("userId" = public.app_current_user_id());

DROP POLICY IF EXISTS "wishlist_delete_own" ON public."WishlistItem";
CREATE POLICY "wishlist_delete_own"
  ON public."WishlistItem"
  FOR DELETE
  TO anon, authenticated
  USING ("userId" = public.app_current_user_id());

-- ============================================================================
--  Next: 004_rls_policies_orders.sql
-- ============================================================================
