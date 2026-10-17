-- MUKRA customer journey: READ-ONLY verification for a staging database.
-- Replace test@example.com and LL-2026-REPLACE with your staging test identifiers.
-- Run BEFORE and AFTER checkout as indicated. Do not paste result sets containing
-- customer PII into public issues. Passwords/hashes are deliberately never selected.

-- 1. Account exists, defaults to CUSTOMER, and has a bcrypt-looking hash/cost.
-- This checks format only; only a successful bcrypt comparison proves validity.
SELECT id, email, name, role, "deletedAt", "createdAt", "updatedAt",
       password ~ '^\$2[aby]\$(10|11|12)\$[./A-Za-z0-9]{53}$' AS bcrypt_cost_10_to_12
FROM "User"
WHERE lower(email) = lower('test@example.com');

-- 2. Legacy case-only duplicates must be resolved deliberately (do not auto-delete).
SELECT lower(trim(email)) AS normalized_email, count(*) AS accounts
FROM "User"
GROUP BY lower(trim(email))
HAVING count(*) > 1;

-- 3. Required columns and unique indexes, without modifying schema or RLS.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'User'
ORDER BY ordinal_position;
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN ('User', 'ProductVariant', 'Order');

-- 4. Latest owned orders. Ownership is userId, NOT the shipping/recipient email.
SELECT o.id, o."orderNumber", o."userId", o.status, o."paymentStatus", o."paymentMethod",
       o.subtotal, o.shipping, o.discount, o."giftWrap", o.total,
       o."shippingCity", o."shippingZip", o."estimatedDelivery", o."createdAt"
FROM "Order" o
JOIN "User" u ON u.id = o."userId"
WHERE lower(u.email) = lower('test@example.com')
ORDER BY o."createdAt" DESC LIMIT 10;

-- 5. Item links, variant selections and the authoritative line prices.
SELECT o."orderNumber", i.id, i."orderId", i."productId", i.name,
       i.color, i.size, i.quantity, i.price, i.quantity * i.price AS line_total,
       v.id AS variant_id, v.stock AS current_variant_stock
FROM "OrderItem" i
JOIN "Order" o ON o.id = i."orderId"
LEFT JOIN "ProductVariant" v ON v."productId" = i."productId"
  AND v.color = i.color AND v.size = i.size
WHERE o."orderNumber" = 'LL-2026-REPLACE';

-- 6. Expected: zero rows for arithmetic/link errors (Float values use a tolerance).
SELECT o.id, o."orderNumber", o.subtotal, sum(i.price * i.quantity) AS item_subtotal,
       o.total, o.subtotal + o.shipping + o."giftWrap" - o.discount AS expected_total
FROM "Order" o
JOIN "OrderItem" i ON i."orderId" = o.id
WHERE o."orderNumber" = 'LL-2026-REPLACE'
GROUP BY o.id
HAVING abs(o.subtotal - sum(i.price * i.quantity)) > 0.01
    OR abs(o.total - greatest(0, o.subtotal + o.shipping + o."giftWrap" - o.discount)) > 0.01;
SELECT i.id FROM "OrderItem" i
LEFT JOIN "Order" o ON o.id = i."orderId"
LEFT JOIN "Product" p ON p.id = i."productId"
WHERE o.id IS NULL OR p.id IS NULL;

-- 7. Saved address: checkbox must be enabled. Same transaction as the order.
SELECT a.id, a."userId", a.name, a.phone, a.address1, a.city, a.state,
       a.zip, a.country, a."isDefault", a."createdAt"
FROM "Address" a JOIN "User" u ON u.id = a."userId"
WHERE lower(u.email) = lower('test@example.com')
ORDER BY a."createdAt" DESC;

-- 8. Stock snapshot: execute BEFORE checkout, record the matching variant count,
-- then execute AFTER checkout. before_stock - after_stock must equal the sum of
-- quantities ordered for the same product/size/color (absent other stock activity).
SELECT p.id, p.name, p.stock AS fallback_product_stock,
       v.id AS variant_id, v.color, v.size, v.stock AS variant_stock
FROM "Product" p LEFT JOIN "ProductVariant" v ON v."productId" = p.id
WHERE p.id IN (SELECT "productId" FROM "OrderItem" WHERE "orderId" IN
  (SELECT id FROM "Order" WHERE "orderNumber" = 'LL-2026-REPLACE'));
-- For the BEFORE snapshot (before an order number exists), filter by a known
-- staging Product.id instead of the subquery above.
SELECT id, stock FROM "ProductVariant" WHERE stock < 0;
SELECT id, stock FROM "Product" WHERE stock < 0;

-- 9. Observe RLS flags/policies only. Never disable RLS to make a test pass.
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class JOIN pg_namespace n ON n.oid = pg_class.relnamespace
WHERE n.nspname = 'public'
  AND relname IN ('User', 'Address', 'Order', 'OrderItem', 'ProductVariant');
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies WHERE schemaname = 'public'
  AND tablename IN ('User', 'Address', 'Order', 'OrderItem', 'ProductVariant');
