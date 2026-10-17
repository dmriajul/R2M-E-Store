# Managing the real product catalogue

The store is **database-driven end to end**: every product, category, coupon,
order and account is a Postgres row. There is no demo catalogue, no sample
orders and no fallback dataset anywhere in the codebase — an empty database
shows honest empty states, and an unreachable one shows a maintenance page.

This guide covers getting the first admin account in place and adding your
real products.

---

## 1. Create the database and the first admin

```bash
cp .env.example .env.local        # set DATABASE_URL (Supabase pooled URI works)
npm run db:push                   # create the tables from prisma/schema.prisma

# The seed creates exactly one SUPER_ADMIN — no products, orders or coupons:
ADMIN_NAME="Your Name" \
ADMIN_EMAIL="you@example.com" \
ADMIN_PASSWORD="a-long-random-password" \
npm run db:seed
```

`prisma/seed.ts` reads the three `ADMIN_*` variables and refuses to run without
them — there are no default credentials to rotate away. Re-running the seed is
safe: an existing account with the same email is left alone (or promoted to
`SUPER_ADMIN` if it held another role).

## 2. Add products through the admin console

Sign in at `/login` with the admin email and password, then:

1. Open **Admin → Products** and press **Add Product** (or press `A` anywhere in
   the console).
2. Fill in **Basics** — name, slug (auto-suggested), description, age range and
   gender.
3. Fill in **Pricing & inventory** — price in BDT, optional compare-at price,
   stock per colour/size **variant** (leave variants empty for one-size pieces),
   low-stock threshold and an optional SKU/cost price.
4. Upload images under **Media** — Cloudinary when the three `CLOUDINARY_*`
   variables are set, otherwise local disk. The first image is the card.
5. Set **Display & visibility** — tick **Active** to publish, tick **Featured**
   for the home-page rail, **New Arrival** for the badge, and set
   **Featured order** (lower shows first) to curate the rail.
6. Save. The console, the storefront, `/shop`, the product page, search and the
   sitemap pick the product up on their next request (the action revalidates
   them for you).

Categories (**Admin → Categories**) and coupons (**Admin → Coupons**) work the
same way. Only a `SUPER_ADMIN` can manage coupons and staff.

## 3. Optional: add products from a script or SQL

For bulk imports you have two options:

- **Direct SQL / Prisma** — insert rows into `Product` (and `ProductVariant`
  when you track stock per size/colour). The columns the storefront reads are
  `name`, `slug`, `description`, `price`, `originalPrice`, `category`,
  `categories`, `gender`, `ageRange`, `material`, `colors`, `sizes`, `images`,
  `stock`, `badge`, `featured`, `featuredOrder`, `newArrival`, `bestSeller`,
  `virtualBoutique` and `active`. `slug` must be unique; `category` must be one
  of the eight fixed names in `lib/site.ts` (`CATEGORY_META`).
- **The admin API** — `POST /api/admin/products` with a JSON body shaped like
  `adminProductSchema` in `lib/validations.ts`, authenticated by a signed-in
  console session (cookies) with the `products:write` permission.

## 4. What the storefront does while the catalogue is empty or down

| Situation | What shoppers see |
| --- | --- |
| 0 active products | `/shop` shows "The collection is being curated"; home sections collapse |
| Database unreachable | "We'll be right back" maintenance page; `GET /api/products` answers **503** |
| Product slug unknown | The 404 page |
| No reviews for a product | "No reviews yet" |

Nothing ever serves demo products, so what you see is always what is in the
database.
