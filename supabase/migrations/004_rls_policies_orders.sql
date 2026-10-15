-- ============================================================================
--  004_rls_policies_orders.sql — Order, OrderItem, ReturnRequest
-- ============================================================================
--
--  The most sensitive rows in the store: who bought what, for how much, and
--  where it shipped. Before this file, anyone with the public `anon` key could
--  read every order through PostgREST. Now:
--
--    Order          SELECT  the buyer's own orders; support & above see all
--                           (SUPPORT_MANAGER, SUPER_ADMIN — legacy ADMIN ≡
--                           SUPER_ADMIN; mirrors PERMISSION_ROLES["orders:read"])
--                   UPDATE  support & above — the staff who manage orders
--                           ("only staff can update order status"). Postgres
--                           can only update rows the caller can see, so the
--                           writers are exactly the staff the SELECT policy
--                           exposes — and exactly PERMISSION_ROLES["orders:write"]
--                           in lib/rbac.ts. Other console roles (SEO,
--                           inventory) never read or write orders.
--                   INSERT  ✖  orders are created server-side at checkout
--                   DELETE  ✖  never over the API
--    OrderItem      SELECT  items of the caller's own orders, or staff
--                   INSERT/UPDATE/DELETE ✖  line items are immutable history
--    ReturnRequest  SELECT  own requests; support & above see all
--                   INSERT  own requests, for the caller's own order/item
--                   UPDATE  support & above ("Support managers can read/update
--                           all returns")
--                   DELETE  ✖  never over the API
--
--  Ownership checks go through the SECURITY DEFINER helpers from
--  002_rls_helper_functions.sql (app_owns_order / app_owns_order_item), so
--  they don't recurse into the RLS of the tables they inspect.
--
--  Every policy is DROP + CREATE, so the file is safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  ORDER — "Users can read their own orders. Support managers and above can
--  read all orders. Only staff can update order status." In Postgres a row
--  must be SELECT-visible before it can be updated, so "staff who update
--  status" resolves to the order staff who can see the row: support & above
--  (the same roles the app gives orders:write).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "order_select_own_or_support" ON public."Order";
CREATE POLICY "order_select_own_or_support"
  ON public."Order"
  FOR SELECT
  TO anon, authenticated
  USING (
    "userId" = public.app_current_user_id()
    OR public.app_is_support_or_above()
  );

DROP POLICY IF EXISTS "order_update_support" ON public."Order";
DROP POLICY IF EXISTS "order_update_staff" ON public."Order";
CREATE POLICY "order_update_support"
  ON public."Order"
  FOR UPDATE
  TO anon, authenticated
  USING (public.app_is_support_or_above())
  WITH CHECK (public.app_is_support_or_above());

-- No INSERT policy: checkout (Server Action) creates orders through Prisma as
-- the owner role — PostgREST cannot fabricate orders.
-- No DELETE policy: orders are financial records; nothing deletes them over the
-- API (the app's admin flows run through Prisma as owner).

-- ---------------------------------------------------------------------------
--  ORDER ITEM — "Users can read items from their own orders. Staff can read
--  all order items."
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "order_item_select_own_or_staff" ON public."OrderItem";
CREATE POLICY "order_item_select_own_or_staff"
  ON public."OrderItem"
  FOR SELECT
  TO anon, authenticated
  USING (
    public.app_owns_order("orderId")
    OR public.app_is_staff()
  );

-- No INSERT/UPDATE/DELETE policies: line items are written once, server-side
-- at checkout (and by refund tooling via Prisma), and never edited over the
-- API. Deny by default keeps the ledger honest.

-- ---------------------------------------------------------------------------
--  RETURN REQUEST — "Users can read/create their own return requests. Support
--  managers can read/update all returns."
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "return_select_own_or_support" ON public."ReturnRequest";
CREATE POLICY "return_select_own_or_support"
  ON public."ReturnRequest"
  FOR SELECT
  TO anon, authenticated
  USING (
    "userId" = public.app_current_user_id()
    OR public.app_is_support_or_above()
  );

DROP POLICY IF EXISTS "return_insert_own" ON public."ReturnRequest";
CREATE POLICY "return_insert_own"
  ON public."ReturnRequest"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- The request must belong to the caller, and reference an order + line
    -- item the caller actually owns (no cross-account return requests).
    "userId" = public.app_current_user_id()
    AND public.app_owns_order("orderId")
    AND public.app_owns_order_item("orderItemId")
  );

DROP POLICY IF EXISTS "return_update_support" ON public."ReturnRequest";
CREATE POLICY "return_update_support"
  ON public."ReturnRequest"
  FOR UPDATE
  TO anon, authenticated
  USING (public.app_is_support_or_above())
  WITH CHECK (public.app_is_support_or_above());

-- No DELETE policy: returns are audit trail — resolved (COMPLETED / REJECTED),
-- never deleted over the API.

-- ============================================================================
--  Next: 005_rls_policies_catalog.sql
-- ============================================================================
