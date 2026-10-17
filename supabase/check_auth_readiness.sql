-- READ-ONLY diagnosis. Run privately as the same PostgreSQL role used by DATABASE_URL.
-- Never disable RLS or grant password access to anon/authenticated to fix Prisma login.
-- This app uses public."User", NOT Supabase Auth's auth.users.
SELECT current_database() AS database_name, current_schema() AS schema_name, current_user AS server_role;

SELECT c.relname AS table_name,
       pg_get_userbyid(c.relowner) AS owner_role,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       r.rolbypassrls, r.rolsuper,
       pg_has_role(current_user, c.relowner, 'USAGE') AS inherits_owner_role,
       has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
       has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,
       has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
       has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_roles r ON r.rolname = current_user
WHERE n.nspname = 'public' AND c.relname IN ('User', 'VerificationToken', 'Order', 'OrderItem')
ORDER BY c.relname;

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND
      ((table_name = 'User' AND column_name IN ('id','email','password','emailVerified','deletedAt','role')) OR
       (table_name = 'VerificationToken'))
ORDER BY table_name, ordinal_position;

SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('User','VerificationToken')
ORDER BY tablename, policyname;
-- Expected: server role has the needed access under the existing owner-role contract.
-- New accounts default deletedAt/emailVerified to NULL; unverified is not a login block.
-- Inspect a dedicated test row by its id separately; never select/publish passwords or bearer links.
