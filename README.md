# Little Luxe 👶✨

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

- 🎨 **Dark luxury theme with a 3D product viewer** — gold-on-charcoal design
  system, WebGL hero (React Three Fiber) and a per-product 3D viewer that
  degrades to gradient artwork when WebGL is unavailable.
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
- ⚡ **Next.js 15 + a 95+ Lighthouse target** — lazy 3D chunks, `next/font`
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
| 3D | three.js + `@react-three/fiber` + `@react-three/drei` (lazy, `ssr: false`) |
| Forms | React Hook Form + Zod (shared schemas, inline errors) |
| State | Zustand (`useCartStore` with `persist`, wishlist, checkout, admin, dashboard) |
| Auth | Auth.js / NextAuth v5 (credentials, JWT, bcryptjs) |
| Database | PostgreSQL via Supabase + Prisma ORM (8 models, 5 enums) |
| Uploads | Cloudinary (images + `.glb`), local-disk fallback |
| Toasts | Sonner (typed icons and colours) |
| Icons | lucide-react |
| Fonts | `next/font/local` — Inter variable, latin subset, `display: swap` |

---

## Quick Start

```bash
git clone https://github.com/<you>/little-luxe.git
cd little-luxe

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

**Demo credentials** — shopper: any email + `password123`; admin:
`admin@littleluxe.com` / `admin123`.

---

## Environment Variables

Every value is optional; each integration switches on independently.

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Production | `https://littleluxe.com` | Canonical origin for metadata, sitemap, robots, OG images |
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
| `NEXT_PUBLIC_STORE_NAME` | no | `Little Luxe` | Brand name used in copy |
| `NEXT_PUBLIC_CURRENCY` | no | `USD` | `USD` \| `EUR` \| `GBP` \| `BDT` |
| `NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD` | no | `50` | Order value that unlocks free delivery |
| `STORE_SUPPORT_EMAIL` | no | `hello@littleluxe.com` | Support address in emails/legal pages |

Templates: [`.env.example`](./.env.example) (local) and
[`.env.production.example`](./.env.production.example) (Vercel).

---

## Demo Mode

`lib/demo-mode.ts` exports `IS_DEMO = !process.env.DATABASE_URL`. When no
environment variables are present:

| Area | Demo behaviour | With env vars |
| --- | --- | --- |
| Catalogue | 12 products from `lib/site.ts` | Prisma `Product` table (seeded identically) |
| Auth | Any email + `password123`, `demo-<local>` user id | Supabase users, bcrypt hashes, JWT sessions |
| Orders | In-memory records, `POST /api/orders` still re-prices the cart | Persisted `Order` + `OrderItem` rows |
| Admin console | Client store seeded from `lib/mock-admin.ts` | Same UI, backed by the API |
| Uploads | Written to `.uploads/` and served via `/uploads/…` | Cloudinary (`little-luxe/products`, `little-luxe/models`) |
| Payments | Wallet numbers + manual verification, cards disabled | Same, plus SSLCommerz when enabled |
| Images | CSS gradients + emoji per category | Cloudinary URLs through `OptimizedImage` |

Every Prisma call is wrapped in `try/catch` and falls back to the mock data, so
adding one env var can never take the site down. `GET /api/health` reports
exactly which integrations are live:

```json
{ "status": "ok", "mode": "demo", "database": "mock", "cloudinary": "local-disk", "sslcommerz": "disabled" }
```

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
                               cloudinary, validations, mock data
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

- **Bundle discipline** — three.js/postprocessing only ever load inside the two
  `next/dynamic({ ssr: false })` viewers; the shop, checkout and admin routes are
  separate chunks; `experimental.optimizePackageImports` trims the icon and R3F
  barrels.
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
  a 3D canvas label that explains how to interact with it.
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
- The admin console is a client-side demo: mutations live for the session and are
  not written back to Postgres (the storefront order API is the wired path).
- `prisma generate` needs to download engine binaries — blocked in offline
  sandboxes. The schema is hand-verified; run `npx prisma generate` once you have
  network access.
- Prices are formatted in USD to keep the seeded catalogue coherent; switch
  `NEXT_PUBLIC_CURRENCY` and the price data together for taka.
- There is no service worker yet, by design (see DEPLOYMENT.md).

---

<p align="center">Made with 💛 for small humans in Dhaka and beyond.</p>
