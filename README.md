# Mukra 👶✨

**Premium Kids Fashion E-commerce** — a dark-luxury storefront for ages 0–14,
built for Bangladesh: taka-aware shipping copy, cash on delivery, bKash / Nagad /
Rocket wallet payments, and a bilingual (English + বাংলা) help centre.

<p>
  <img alt="Next.js 15" src="https://img.shields.io/badge/Next.js-15-black?style=flat-square">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149eca?style=flat-square">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square">
  <img alt="Tailwind v4" src="https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square">
  <img alt="PWA ready" src="https://img.shields.io/badge/PWA-ready-d4af37?style=flat-square">
</p>

---

## Features

- 🎨 **Dark luxury theme with high-resolution product photography** — gold-on-
  charcoal design system, touch-friendly image galleries and zoomable product
  details with graceful artwork fallbacks.
- 🛍️ **Full e-commerce flow** — shop with URL-driven filters, quick view,
  product detail, cart, multi-step checkout, order confirmation and tracking.
- 💳 **COD + bKash + Nagad + Rocket** — manual wallet payments with screenshot
  upload, admin-side verification, and SSLCommerz parked behind a "Coming soon".
- 🌐 **Bilingual (English + বাংলা)** — five legal/help documents with an instant
  language toggle, plus bilingual payment and delivery copy.
- 📱 **PWA-ready, mobile-first** — web manifest, real PNG + SVG icons, maskable
  icon, install shortcuts, and 44px touch targets throughout.
- 🔐 **Admin panel with full CRUD** — products, orders, customers, coupons and
  categories, with a payment-verification queue and printable invoices.
- 📊 **Analytics dashboard** — KPI cards with sparklines, a CSS-only revenue
  chart, bestsellers, low-stock alerts and traffic breakdowns.
- ⚡ **Next.js 15 + a 95+ Lighthouse target** — route-level code splitting, `next/font`
  self-hosted Inter, AVIF/WebP images, route-level code splitting and immutable
  cache headers for static assets.
- 🗄️ **Supabase + Prisma with a demo mode included** — every integration is
  optional; with zero environment variables the whole site still works.

---

## Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15.5 (App Router, React 19, Turbopack-compatible) |
| Language | TypeScript in `strict` mode (`noUnusedLocals`, `noUncheckedIndexedAccess`) |
| Styling | Tailwind CSS v4, `tw-animate-css`, CSS custom-property design tokens |
| UI primitives | shadcn/ui (new-york-v4) on the unified `radix-ui` package |
| Animation | Framer Motion (page fades, accordions, drawers, confetti) |
| Forms | React Hook Form + Zod (shared schemas, inline errors) |
| State | Zustand (`useCartStore` with `persist`, wishlist, checkout, admin, dashboard) |
| Auth | Auth.js / NextAuth v5 (credentials, JWT, bcryptjs) |
| Database | PostgreSQL via Supabase + Prisma ORM (8 models, 5 enums) |
| Uploads | Cloudinary (product images), local-disk fallback |
| Toasts | Sonner (typed icons and colours) |
| Icons | lucide-react |
| Fonts | `next/font/local` — Inter variable, latin subset, `display: swap` |

---

## Quick Start

```bash
git clone https://github.com/<you>/mukra.git
cd mukra

npm install
npm run dev            # http://localhost:3000
```

That is the whole setup — **no `.env` file, no database, no API keys.** The app
boots in demo mode (see below) and every screen is explorable.

```bash
npm run build          # production build
npm run start          # serve the production build
npm run lint           # eslint (zero warnings)
npx tsc --noEmit       # strict type check

npm run db:push        # prisma db push      (needs DATABASE_URL)
npm run db:seed        # seed demo data
npm run db:studio      # browse the database
```

**Demo credentials** — one account per console role, plus a shopper:

| Role | Email | Password | Console access |
| --- | --- | --- | --- |
| Super admin | `admin@mukra.com` | `password123` | everything |
| Inventory manager | `inventory@mukra.com` | `password123` | dashboard, products, categories |
| SEO manager | `seo@mukra.com` | `password123` | dashboard, products (metadata), settings |
| Support manager | `support@mukra.com` | `password123` | dashboard, orders, returns, customers |
| Shopper | `sarah@example.com` (or any email) | `password123` | storefront + account area |

`prisma/seed.ts` creates the same staff accounts once a database is connected:
`admin@ · inventory@ · seo@ · support@mukra.com`, all with the shared demo
password `password123`.

---

## Environment Variables

Every value is optional; each integration switches on independently.

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Production | `https://mukra.com` | Canonical origin for metadata, sitemap, robots, OG images |
| `DATABASE_URL` | for real data | — | Supabase **pooled** Postgres URI (`?pgbouncer=true`) |
| `DIRECT_URL` | for migrations | — | Supabase direct URI used by `prisma db push` |
| `NEXTAUTH_SECRET` | Production | demo secret | JWT signing key — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Production | `http://localhost:3000` | Public auth callback origin (no trailing slash) |
| `CLOUDINARY_CLOUD_NAME` | for CDN uploads | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | for CDN uploads | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | for CDN uploads | — | Cloudinary API secret |
| `PAYMENT_BKASH_NUMBERS` | no | `+8801707302038,+8801954447017` | Wallet numbers shown at checkout |
| `PAYMENT_NAGAD_NUMBERS` | no | same default | Nagad receiving numbers |
| `PAYMENT_ROCKET_NUMBERS` | no | same default | Rocket receiving numbers |
| `NEXT_PUBLIC_ENABLE_SSLCOMMERZ` | no | `false` | Shows the card option ("Coming soon" while false) |
| `SSLCOMMERZ_STORE_ID` / `SSLCOMMERZ_STORE_PASSWORD` | no | — | Gateway credentials once cards go live |
| `SSLCOMMERZ_SANDBOX` | no | `true` | Sandbox vs live SSLCommerz |
| `MAILJET_API_KEY` | for admin receipt emails | — | Mailjet API key used by the authenticated resend-receipt endpoint |
| `MAILJET_SECRET_KEY` | for admin receipt emails | — | Mailjet secret key |
| `MAILJET_SENDER_EMAIL` | for admin receipt emails | — | Verified sender email address configured in Mailjet |
| `NEXT_PUBLIC_STORE_NAME` | no | `Mukra` | Brand name used in copy |
| `NEXT_PUBLIC_CURRENCY` | no | `USD` | `USD` \| `EUR` \| `GBP` \| `BDT` |
| `NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD` | no | `50` | Order value that unlocks free delivery |
| `STORE_SUPPORT_EMAIL` | no | `hello@mukra.com` | Support address in emails/legal pages |

Templates: [`.env.example`](./.env.example) (local) and
[`.env.production.example`](./.env.production.example) (Vercel).

---

## Demo Mode

`lib/demo-mode.ts` exports `IS_DEMO = !process.env.DATABASE_URL`. When no
environment variables are present:

| Area | Demo behaviour | With env vars |
| --- | --- | --- |
| Catalogue | 12 products from `lib/site.ts` | Prisma `Product` table (seeded identically) |
| Auth | Any email + `password123`, `demo-<local>` user id; the four role accounts above | Postgres users, bcrypt hashes, JWT sessions carrying the role |
| Orders | In-memory records, `POST /api/orders` still re-prices the cart | Persisted `Order` + `OrderItem` rows |
| Admin console | Same UI, in-session Zustand store (not durable) | Postgres through Server Actions + Prisma |
| Uploads | Written to `.uploads/` and served via `/uploads/…` | Cloudinary (`mukra/products`, `mukra/models`) |
| Payments | Wallet numbers + manual verification, cards disabled | Same, plus SSLCommerz when enabled |
| Images | CSS gradients + emoji per category | Cloudinary URLs through `OptimizedImage` |

Every Prisma call is wrapped in `try/catch` and falls back to the mock data, so
adding one env var can never take the site down. `GET /api/health` reports
exactly which integrations are live:

```json
{ "status": "ok", "mode": "demo", "database": "mock", "cloudinary": "local-disk", "sslcommerz": "disabled" }
```

## Roles & permissions (RBAC)

The console has four operator roles. The matrix lives in **`lib/rbac.ts`** as
plain data and is enforced at four points — edge middleware, the per-section
server layouts, the Server Actions and the API routes — so nothing can drift out
of sync, and the sidebar only ever shows what the role can actually open.

| Section | Super admin | Inventory manager | SEO manager | Support manager |
| --- | :-: | :-: | :-: | :-: |
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Products | ✅ | ✅ | ✅ *(metadata + placement only)* | — |
| Categories | ✅ | ✅ | — | — |
| Orders / Returns / Customers | ✅ | — | — | ✅ |
| Coupons | ✅ | — | — | — |
| Settings (hero/banners) | ✅ | — | ✅ | — |
| Analytics | ✅ | — | — | — |

How it is enforced:

1. **`middleware.ts` → `lib/auth.config.ts`** — runs on the edge for every
   `/admin/*` request. A signed-out visitor goes to `/login?callbackUrl=…`, a
   shopper to `/dashboard`, and a staff member without the section role to
   `/unauthorized?from=…`. This covers POSTs (Server Action calls) too.
2. **Per-section layouts** — `app/admin/<section>/layout.tsx` calls
   `requireAdminSection(section)`, so a page can never render for the wrong role
   even if the middleware were bypassed.
3. **Server Actions** — every action in `app/admin/actions.ts` starts with
   `requirePermission("products:write")` and friends, which resolves the Auth.js
   session and checks it against the same matrix. An action is a public POST
   endpoint, so this is the check that really protects the data.
4. **API routes** — `app/api/admin/**` guards with
   `requireActionRole(rolesForPermission(…))`, answering 401 (no session) or 403
   (wrong role).

The session is real now: `lib/auth.ts` normalises the stored role (the legacy
two-role `ADMIN` value reads as `SUPER_ADMIN`, so an un-migrated database keeps
working), the JWT/session callbacks carry it, and the console renders it —
`app/admin/layout.tsx` resolves the operator and `AdminSessionProvider` hands the
role to the client components (`AdminShell`, `ProductForm`, the dashboard), which
use the same `can("products:write")` helpers to hide what the server would reject
anyway.

| Role | Shown in the profile menu as |
| --- | --- |
| `SUPER_ADMIN` | Full access to every console section |
| `INVENTORY_MANAGER` | Products, categories and stock |
| `SEO_MANAGER` | Product metadata, banners and SEO |
| `SUPPORT_MANAGER` | Orders, returns and customers |

### Database change required

The `Role` enum gained the console roles. `ADMIN` is **kept** so an existing
database keeps working — it simply reads as `SUPER_ADMIN` everywhere:

```diff
 enum Role {
   CUSTOMER
-  ADMIN
+  ADMIN            // legacy alias of SUPER_ADMIN
+  SUPER_ADMIN
+  INVENTORY_MANAGER
+  SEO_MANAGER
+  SUPPORT_MANAGER
 }
```

Adding enum values is additive in Postgres (`ALTER TYPE … ADD VALUE`) and no
table is rewritten. Apply with `npm run db:push`, then `npm run db:seed` to write
the super-admin role and create one account per manager role.

---

## Admin writes (Server Actions + Prisma)

Every mutation in the console goes through **`app/admin/actions.ts`** — Next.js 15
Server Actions that run on the server, not in the browser:

| Action | What it writes |
| --- | --- |
| `saveProductAction` | Create/update a product, including `featuredOrder`, the display placements (`categories`, `virtualBoutique`, `newArrival`, `bestSeller`, `featured`) and `active` |
| `saveProductSeoAction` | The SEO manager's write path: slug, `metaTitle`, `metaDescription`, badge, publication and display placement — never pricing, media or stock |
| `deleteProductsAction` | Hard-deletes products and their variants |
| `duplicateProductAction` | Copies a product as an unpublished draft (unique `-copy` slug/SKU) |
| `setProductsOutOfStockAction` | Zeroes stock on products *and* every variant |
| `restockProductAction` | Adds units, spread across variants |
| `updateOrderStatusAction` | Pending → Confirmed → Processing → Shipped → Delivered, or Cancelled / Refunded |
| `decidePaymentAction` | Manual wallet verification (bKash / Nagad / Rocket): approve → **Confirmed + Paid**, reject → **Cancelled + Failed**, plus COD cash collection → **Delivered + Paid**. A verified wallet payment now has its own **Confirmed** status (the console used to fold `CONFIRMED` into *Processing*) |
| `addOrderNoteAction` / `refundOrderAction` | Order notes and full refunds |
| `saveCategoryAction` / `deleteCategoryAction` | Category metadata (name, slug, emoji, blurb, parent) |

Rules the actions follow:

1. **Role-guarded.** Each action re-checks the Auth.js session *and* the caller's
   role (`lib/rbac.ts`) before touching data — middleware guards the pages, but an
   action is a public POST endpoint. A caller without the permission gets
   `{ ok: false, error }`, never data.
2. **Zod-validated.** Arguments arrive as `unknown` and are parsed with the shared
   schemas in `lib/validations.ts` before they reach Prisma.
3. **No silent demo fallback.** With `DATABASE_URL` set, a write either commits or
   returns `{ ok: false, error }` — `withDatabase()`'s catch-and-serve-mock
   behaviour is deliberately unused here, so an operator is never told a change
   was saved when it wasn't. With no database at all the action reports
   `source: "demo"` and the console updates its in-session store.
4. **Revalidated.** Successful writes call `revalidatePath` for the console, the
   storefront (`/`, `/shop`, `/product/[id]`, `/sitemap.xml`) and the shopper's
   order pages, so both sides reflect the change on the next render.

The console reads live rows too: `app/admin/layout.tsx` loads products, orders and
categories on the server and seeds the Zustand store through
`components/admin/AdminDataHydrator.tsx`, so the tables, the dashboard widgets and
the low-stock alert all show the same records the actions mutate.

### Database change required

The additive Prisma change below has been written to `prisma/schema.prisma`:

```prisma
/// Console-managed category metadata.
model Category {
  id          String   @id @default(cuid())
  name        String   @unique
  slug        String   @unique
  emoji       String   @default("🧸")
  description String   @default("")
  parent      String?
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([parent])
  @@index([sortOrder, name])
}
```

Apply it through the approved database-change process (`npm run db:push`, then
`npm run db:seed` to load the eight storefront categories), and run
`npx prisma generate` where engine downloads are available. Nothing else in the
schema changed: products, orders and coupons already had every column the console
needs.

---

## Product display placement

Admins can manage Virtual Boutique, Homepage Featured, New Arrivals and
Best Sellers placement from **Admin → Products → Display & Visibility**. The
existing `category` remains the primary category; additional assignments use
the same fixed category names and are stored in `Product.categories`. Legacy
rows with no additional assignments continue to use their primary category.
Publication continues to use `Product.active`, and featured ordering uses
`featuredOrder` (lower values appear first, with newest-first tie breaking).

These settings persist across sessions when the Prisma database is enabled.
Demo mode keeps the existing in-memory admin catalogue and is not a durable
storage option. This repository uses `npm run db:push` rather than checked-in
Prisma migration files. The additive schema changes have not been applied to a
database; apply `npm run db:push` only through the approved database-change
process, and do not point it at production without explicit approval.

---

## Deployment

The full runbook lives in **[DEPLOYMENT.md](./DEPLOYMENT.md)** — GitHub → Vercel
→ environment variables → domain → Supabase → Cloudinary → `prisma db push` →
seed → go live, plus a post-deploy smoke test and a troubleshooting table.

Quick version:

```bash
npx vercel --prod
```

`vercel.json` pins the build command, the Singapore region (`sin1`) and the
production security headers.

---

## Project Structure

```
app/
├── (auth)/                    login, register, forgot-password (chrome-free shell)
├── (shop)/                    storefront: home, shop, product, checkout, dashboard,
│   ├── dashboard/             account area — orders, wishlist, addresses, profile
│   ├── product/[id]/          product detail (SSG, per-product metadata + JSON-LD)
│   ├── faq|returns|shipping|terms|privacy/   bilingual legal pages
│   ├── loading.tsx            product-grid skeleton
│   └── error.tsx              storefront error boundary
├── admin/                     operations console — products, orders, customers,
│                              coupons, categories, analytics, settings
│   ├── actions.ts             Server Actions (Zod + role guard + revalidatePath)
│   ├── layout.tsx             session + products/orders/categories for the console
│   └── <section>/layout.tsx   RBAC gate per console section
├── api/                       auth, register, orders, products, upload, health
├── uploads/[...path]/         local-disk upload streaming (demo mode)
├── offline/                   offline fallback destination
├── opengraph-image.tsx        dynamic 1200×630 social card (next/og)
├── sitemap.ts · robots.ts     SEO routes
├── layout.tsx                 fonts, metadata, PWA wiring, skip-to-content
├── loading.tsx · error.tsx · not-found.tsx
└── globals.css                design tokens, print styles, focus ring

components/
├── admin/                     console tables, forms, sheets, chart, shell
├── checkout/                  stepper, payment picker, confirmation
├── dashboard/                 account area widgets
├── layout/                    Navbar, Footer, CartSheet, SearchDialog, LegalPage
├── product/                   card, gallery, quick view, reviews, artwork
├── sections/                  hero, featured rail, collections, stats
├── seo/                       <JsonLd /> renderer
├── three/                     hero scene, product viewer, fallbacks
└── ui/                        shadcn primitives + SkipToContent, BackToTop,
                               OptimizedImage, Skeleton

lib/                           cart maths, config, demo-mode, seo (JSON-LD),
                               image-optimizer, legal-content, payments, prisma,
                               cloudinary, validations, mock data, rbac (roles)
lib/data/                      admin-orders · admin-products · categories ·
                               admin-errors — Prisma reads/writes for the console
store/                         zustand stores (cart, wishlist, checkout, admin, …)
prisma/                        schema.prisma + seed.ts
public/                        manifest.json, icons/, images/, models/, demo/
scripts/                       make-pwa-icons.py (regenerates the PWA icons)
```

---

## Payment Numbers

Wallet payments are collected manually and verified in the admin console
(Admin → Orders → *Verify payment*). The same numbers are shown at checkout and
on the confirmation page, and are overridable with the `PAYMENT_*` variables.

| Wallet | Numbers |
| --- | --- |
| **bKash** | `+8801707302038`, `+8801954447017` |
| **Nagad** | `+8801707302038`, `+8801954447017` |
| **Rocket** | `+8801707302038`, `+8801954447017` |
| **Cash on Delivery** | pay the courier — no fee |
| **SSLCommerz (cards)** | coming soon |

Customers send the exact amount, put the order number in the reference, upload a
screenshot, and tick "I've completed the payment". The team verifies within
1–2 hours and the order moves to *Confirmed*.

---

## Performance, SEO & Accessibility

- **Bundle discipline** — the shop, checkout and admin routes are separate
  chunks; `experimental.optimizePackageImports` trims icon and animation imports.
- **Images** — every product image renders through `OptimizedImage` (a
  `next/image` wrapper) with a preset-aware loader, responsive `srcSet`, a
  blurred 24px placeholder, a golden shimmer while loading and a gradient
  fallback tile. Only the first four cards above the fold are `priority`.
- **Caching** — immutable one-year headers for `/_next/static`, 60s CDN TTL with
  `stale-while-revalidate` for HTML, short cache for `/api/products`, `no-store`
  for auth and orders.
- **SEO** — title template, per-page canonicals, OpenGraph + Twitter cards, a
  dynamic sitemap, robots directives, and JSON-LD for `Organization`,
  `Product`, `BreadcrumbList` and `FAQPage`.
- **Accessibility** — a Skip-to-content link, `#main-content` landmark, 2px gold
  focus outlines, ARIA labels on every icon-only control, `aria-describedby`
  error wiring, `aria-live` cart announcements, alt text on product imagery and
  keyboard-accessible image zoom controls.
- **PWA** — `public/manifest.json`, 192/512/maskable PNGs plus an SVG icon,
  `theme-color: #D4AF37`, and Apple web-app metadata. Installable today; a
  service worker is a documented opt-in in DEPLOYMENT.md.

---

## Build history

The project was delivered in eight reviewable steps, each one committed and
verified with `tsc --noEmit`, `eslint`, a production build and a curl sweep:

1. **Foundation** — design system, layout chrome, hero, motion primitives.
2. **Shop & product pages** — URL-driven filters, product detail, quick view.
3. **Cart, checkout & auth** — cart store, three-step checkout, login/register.
4. **Account area** — dashboard, orders, tracking, wishlist, addresses, profile.
5. **Admin console** — products, orders, customers, coupons, categories,
   settings and analytics.
6. **Backend** — Prisma schema + seed, Auth.js, payments, Cloudinary uploads.
7. **Legal pages & images** — five bilingual documents, image optimisation.
8. **Final polish** — SEO, accessibility, PWA, deployment configuration.

### Known limitations

- SSLCommerz is intentionally parked; cards show "Coming soon".
- Admin console writes (`app/admin/actions.ts`) are wired to Postgres through
  Server Actions, so products, orders and categories persist. Demo installs
  without `DATABASE_URL` keep the old in-session behaviour: the action answers
  `source: "demo"` and the change is applied to the Zustand store only. Console
  customers, coupons and store settings are still session-only — their routes and
  API endpoints are RBAC-guarded, but those mutations have no Server Action yet.
- `/unauthorized` is the destination for a role that can't open a section; a
  shopper who opens `/admin` is sent to `/dashboard` instead.
- Deleting a product that appears in an existing order is refused (order lines
  are the sales history) — turn `Active` off to hide it from the storefront.
- `prisma generate` needs to download engine binaries — blocked in offline
  sandboxes. The schema is hand-verified; run `npx prisma generate` once you have
  network access.
- Prices are formatted in USD to keep the seeded catalogue coherent; switch
  `NEXT_PUBLIC_CURRENCY` and the price data together for taka.
- There is no service worker yet, by design (see DEPLOYMENT.md).

---

<p align="center">Made with 💛 for small humans in Dhaka and beyond.</p>
