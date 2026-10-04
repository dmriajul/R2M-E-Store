# LUXE — Premium Dark E-Commerce Foundation

A dark-luxury storefront foundation built with **Next.js 15 (App Router)**, **TypeScript (strict)**, **Tailwind CSS v4**, **shadcn/ui**, **Zustand**, and motion libraries (framer-motion, GSAP, react-three-fiber) installed and ready for the next step.

> **Status: Step 1 complete — foundation only.** No full pages, no 3D scenes, no database.
> Every route currently renders a clearly-labelled placeholder so the shell can be verified.

---

## Stack

| Layer      | Choice                                                      |
| ---------- | ----------------------------------------------------------- |
| Framework  | Next.js 15.5 (App Router, React 19, Turbopack-optional)      |
| Language   | TypeScript 5 — `strict` + `noUnusedLocals` + `noUncheckedIndexedAccess`, `any` banned by ESLint |
| Styling    | Tailwind CSS v4 (`@theme inline` tokens) + shadcn/ui         |
| State      | Zustand 5 (cart store with derived `total` / `itemCount`)    |
| Motion     | framer-motion, GSAP *(installed, unused yet)*                |
| 3D         | @react-three/fiber, @react-three/drei, three *(installed, unused yet)* |
| Typeface   | Inter — self-hosted variable font via `next/font/local`      |

### shadcn/ui components included
`button` · `card` · `sheet` · `input` · `badge` · `separator` · `skeleton` · `dialog` · `dropdown-menu` · `avatar`

---

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (passes clean)
npm run lint    # eslint (0 warnings)
npx tsc --noEmit
```

---

## Design system

All tokens live in `app/globals.css` and are exposed as Tailwind utilities via `@theme inline`
(e.g. `bg-background`, `text-primary`, `border-glass-border`, `bg-glass`).

| Token            | Value                        | Usage                          |
| ---------------- | ---------------------------- | ------------------------------ |
| `--background`   | `#0A0A0A`                    | Page canvas                    |
| `--foreground`   | `#FAFAFA`                    | Body text                      |
| `--primary`      | `#D4AF37` (gold)             | CTAs, accents, active nav      |
| `--accent`       | `#00F0FF` (neon cyan)        | Secondary highlights           |
| `--muted`        | `#1A1A1A`                    | Surfaces, muted backgrounds    |
| `--border`       | `#2A2A2A`                    | Hairlines, inputs              |
| `--glass`        | `rgba(255,255,255,0.05)`     | Frosted surfaces               |
| `--glass-border` | `rgba(255,255,255,0.1)`      | Frosted borders                |

Also included: a fixed, pointer-transparent **noise/grain overlay** on `body::before`, a **thin gold
scrollbar** (WebKit + Firefox), smooth scrolling with reduced-motion fallbacks, and utility classes
`.glass`, `.glass-strong`, `.text-gradient-gold`, `.hairline-gold`, `.glow-gold`, `.glow-cyan`.

---

## Folder structure

```
app/
  (shop)/
    page.tsx                 → Home placeholder
    shop/page.tsx            → Shop placeholder
    product/[id]/page.tsx    → Product placeholder (async params, Next 15)
  (auth)/
    login/page.tsx           → Login placeholder
  admin/
    layout.tsx               → console shell (sidebar + top bar, no Navbar/Footer)
    page.tsx                 → /admin dashboard (KPIs, revenue, activity)
    products/page.tsx        → products table + add/edit sheet
    orders/page.tsx          → orders table + detail sheet
    customers/page.tsx       → customer table + detail sheet
    coupons/page.tsx         → coupon table + create/edit dialog
    categories/page.tsx      → category cards + create/edit dialog
    settings/page.tsx        → general / shipping / payments / notifications tabs
    analytics/page.tsx       → revenue chart, breakdowns, top customers
    loading.tsx              → shared console skeleton
  api/
    health/route.ts          → GET liveness probe
    products/route.ts        → GET mock catalogue (?category=, ?featured=true)
  fonts/                     → Inter variable woff2 (self-hosted)
  globals.css                → design system
  layout.tsx                 → Inter + metadata + Navbar/Footer shell
components/
  admin/                     → AdminShell, DataTable, KpiCard, BarChart, ProductForm, OrderDetailSheet, …
  layout/                    → Navbar, Footer, MobileMenu, CartSheet, SearchDialog, NewsletterForm, PagePlaceholder, SocialIcons
  sections/                  → (empty — next step)
  three/                     → (empty — no scenes yet)
  ui/                        → shadcn/ui components
lib/
  utils.ts                   → cn(), formatPrice(), slugify(), date formatters
  site.ts                    → site config, nav links, mock products
  mock-admin.ts              → console dataset (orders, customers, coupons, revenue)
store/
  useCartStore.ts            → zustand cart
  useAdminStore.ts           → zustand console CRUD (products, orders, coupons, settings)
types/
  index.ts                   → Product, CartItem, User, Order, Address, ApiResponse
public/
  images/                    → (empty)
  models/                    → (empty — for .glb files)
```

---

## Cart store

`store/useCartStore.ts` — `items[]`, `addItem(product, quantity, variant?)`, `removeItem(id)`,
`updateQuantity(id, qty)`, `clearCart()`, plus derived `total` and `itemCount` recomputed on every
mutation. Quantities are clamped to `min(stock, 10)`. Typed selectors (`selectCartItems`,
`selectCartTotal`, `selectCartItemCount`, `selectIsInCart`) are exported for narrow subscriptions.

Persistence is intentionally **not** wired up — layer on zustand's `persist` middleware when the
backend lands.

---

## Notes & environment caveats

- **Fonts:** `next/font/google` requires network access at build time, which is blocked in this
  sandbox — Inter is therefore self-hosted through `next/font/local` (`app/fonts/`). Re-vendor it with:
  `cp node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2 app/fonts/inter-latin-variable.woff2`
- **shadcn registry:** `npx shadcn@latest init` could not reach `ui.shadcn.com` from this sandbox, so the
  same official component sources were fetched from the `shadcn-ui/ui` repository, imports rewritten to
  `@/lib/utils` / `@/components/ui/*`, and `components.json` was authored to match the CLI format.
  `npx shadcn@latest add <component>` will work normally once the registry is reachable.
- **lucide-react v1** removed brand icons, so the footer socials live in
  `components/layout/SocialIcons.tsx` as inline SVGs.
- `next.config.ts` sets `allowedDevOrigins` so the hosted preview proxy can reach the dev server.

## Step 3 — Kids fashion shop & product pages

The catalogue is now 12 kids pieces (ages 0–14) across six categories. Everything is typed, mock-backed
and filterable; no database yet.

```bash
/shop                          # catalogue: category + age + gender filters, sort, grid/list
/shop?category=dresses         # filters live in the URL and render on the server (shareable)
/shop?age=3-5Y&gender=girls&sort=price-asc
/product/floral-summer-dress   # 3D viewer + gallery, variant pickers, reviews, JSON-LD
```

- **Data** — `lib/site.ts` holds the 12 seeded products, `categories`, `ageFilters`, `getProducts()`
  and `getProductById()`. Age buckets are matched by *overlap* (`3-6Y` shows under both `3-5Y` and
  `6-8Y`), and the "Girls"/"Boys" pills also include Unisex pieces.
- **Shop** — sticky glass filter bar (inline from `lg`, bottom-sheet on mobile), 2/3/4-column grid,
  `AnimatePresence` reflow, quick-view dialog, wishlist hearts, 8-per-page "Load more", 🧸 empty state.
  Filters sync to `?category=&age=&gender=&sort=&view=`; the server reads them on first paint.
- **3D viewer** — `components/three/ProductViewer.tsx`: category-shaped placeholder (cone dress,
  elongated shoe box, cylinder torso, torus accessory, rounded-box tee, capsule bottoms) in a
  fabric-like `meshPhysicalMaterial` (clearcoat + sheen), warm studio lighting, `Environment
  preset="apartment"` with the same procedural fallback as the hero, orbit/zoom auto-rotation, and a
  ⭐ spinner. Runs `frameloop="demand"` and pauses off-screen.
- **Product page** — server component composing client parts: gallery tabs (3D / images), colour and
  size pickers with a size-guide modal, quantity, add-to-bag + wishlist, trust badges, four accordions,
  review summary with distribution bars and three mock parent reviews, related products, and
  Product JSON-LD including `audience` (min/max age, gender), sizes, colours and availability.

### Known limitations

- The wishlist is session-scoped (no persistence yet).
- Image placeholders are gradient + emoji tiles; `product.images` holds tokens, not file paths.

## Step 4 — Cart, checkout & auth

```bash
/checkout        # 4-step flow: Information → Shipping → Payment → Confirm
/login           # demo: any email + password123
/register        # password strength meter, terms consent
/forgot-password # mock "check your inbox" state
```

- **Cart lines are variant-keyed.** A line's id is
  `${productId}-${color}-${size}` (`lineId`, see `types/index.ts`), so the same product in 4T and 5
  are two rows. `updateItemSize`/`updateItemColor` rewrite the key and *merge* if the target
  combination already exists. `removeItem`/`updateQuantity` accept either a `lineId` or a legacy
  `productId`, and `CartItem.id` remains an alias of `productId` for earlier components.
- **Cart drawer** (`components/layout/CartSheet.tsx`) — free-shipping progress bar, per-line qty
  stepper, AnimatePresence add/remove, coupon field and a sticky summary with checkout CTA.
- **Checkout** — React Hook Form + Zod (`lib/validations.ts`), answers held in
  `store/useCheckoutStore.ts` so they survive step navigation, stepper with clickable completed
  steps, sticky order summary, mock payment (card / bKash / Nagad / SSLCommerz) and a confetti
  confirmation. Money maths lives in `lib/cart.ts` (free shipping ≥ $50, express $9.99, gift wrap
  $3.99, coupons `LITTLE10` / `WELCOME15` / `GRANDMA5`).
- **Auth** — chrome-free group with an animated CSS backdrop; mock sign-in (any email +
  `password123`), registration with strength meter, and a reset-link screen.
- **Toasts** — one sonner `<Toaster />` in the root layout, styled dark. The cart store raises
  "Added to bag! 🛍️" / "Removed from bag" / "Free shipping unlocked! 🚚", so every add-to-cart
  entry point is covered.

### Layout note

Page chrome moved out of the root layout so auth pages can render without a navbar: the navbar +
footer live in `app/(shop)/layout.tsx`, `app/(auth)/layout.tsx` provides the focused shell, and
`app/admin/layout.tsx` renders the console shell (sidebar + top bar). `app/layout.tsx` keeps fonts,
metadata and the toaster.

## Step 5 — Account area (dashboard, orders, wishlist, profile)

```bash
/dashboard               # overview: stats, recent orders, recommendations, quick actions
/dashboard/orders        # 5 mock orders with status filters + expandable detail
/dashboard/orders/[id]   # tracking timeline, shipping, item table, returns, printable invoice
/dashboard/wishlist      # saved pieces wired to useWishlistStore + "Move to Cart"
/dashboard/addresses     # up to 3 addresses, add/edit/delete, set default
/dashboard/profile       # details, password (with strength meter), preferences, danger zone
/dashboard/notifications # unread rail, mark-as-read, mark all
```

- **Layout** (`app/(shop)/dashboard/layout.tsx` → `components/dashboard/DashboardShell.tsx`) —
  glass sidebar that collapses to icons on tablet, a bottom tab bar on phones, breadcrumb trail,
  an unread count on Notifications and an `AnimatePresence` transition keyed on the pathname.
- **Mock data** lives in `lib/mock-dashboard.ts`: `DEMO_NOW` (a frozen "today"), the shopper,
  addresses, notifications and five orders. Order lines are built from the real catalogue via
  `getProductById` and priced with `computeTotals`, so the numbers can't drift from the bag and
  checkout.
- **Deterministic dates.** `formatShortDate` / `formatStamp` / `formatRelative(iso, anchorIso)`
  read the UTC fields of `DEMO_NOW`, so "Delivered 3 days ago" and "Oct 1, 2026, 9:00 AM" render
  identically on the server and after hydration — no locale or clock drift.
- **Interactive state** (`store/useDashboardStore.ts`) — profile, addresses, notifications and
  notification preferences, so an edit survives navigation between the account pages.
- **Forms** — every one is React Hook Form + Zod using the shared schemas in `lib/validations.ts`
  (`addressSchema`, `profileSchema`, `passwordChangeSchema`, `returnRequestSchema`), with inline
  errors and dark inputs + gold focus rings matching checkout.
- **Printing** — the order page renders a light `#print-invoice` document; `@media print` in
  `app/globals.css` hides the navbar, footer and account navigation so only the invoice prints.

## Step 6 — Admin console

```bash
/admin              # KPIs, revenue overview, recent orders, bestsellers, low-stock alerts
/admin/products     # dense product table, filters/sort/bulk actions, add + edit sheet
/admin/orders       # order stats, status tabs, date ranges, CSV export, detail sheet
/admin/customers    # customer table with ban/unban and a profile sheet
/admin/coupons      # coupon table with live/expired/depleted status and a create dialog
/admin/categories   # category cards with product counts and an emoji picker
/admin/settings     # general · shipping · payments · notifications, saved section by section
/admin/analytics    # revenue chart, orders by category, traffic sources, top customers
```

- **Shell** (`components/admin/AdminShell.tsx`) — collapsible dark-glass rail on desktop (icons
  only at 72px), slide-in drawer on phones, sticky top bar with a global search that hands the term
  to the product table, an alert bell (badge counts low-stock products) and a profile menu
  (Profile · Settings · Logout). Breadcrumb + page title come from `components/admin/admin-nav.ts`,
  which is the single source of truth for the console navigation.
- **Palette** — the console runs on its own surfaces (`#0D0D0D` page, `#141414` cards, `#242424`
  borders) with **blue `#3B82F6` as the action colour**; gold is reserved for the logo, KPI numbers
  and premium highlights, so admin actions never compete with storefront branding.
- **Data** (`lib/mock-admin.ts`) — every table reads the same record set: `ADMIN_ORDERS` reuses the
  five shopper orders from `lib/mock-dashboard.ts` and adds seven more (all statuses), customers are
  derived from those orders (order count + lifetime spend), products come from `lib/site.ts`
  (no duplicated catalogue), and the 7-day revenue series sums to **$8,432.00** (`Avg $1,204.57/day`).
- **State** (`store/useAdminStore.ts`) — zustand store seeded from the mock data; creating, editing,
  duplicating, deleting, restocking, refunding and status changes all update the store locally and
  raise a toast. Timelines are rebuilt from the order status so the tracking view stays coherent.
- **Tables** (`components/admin/DataTable.tsx`) — one component drives products, orders, customers
  and coupons: client-side sorting, 10 rows per page (`Showing 1–10 of 12`), optional row selection
  with a bulk bar, zebra rows, row hover and horizontal scroll on small screens.
- **Charts** — no charting dependency: `components/admin/BarChart.tsx` draws the revenue bars,
  sparklines and every breakdown bar with Tailwind + framer-motion, including hover tooltips and
  y/x axis labels.
- **Forms** — React Hook Form + Zod everywhere (`adminProductSchema`, `adminCouponSchema`,
  `adminCategorySchema`, the four `settings*Schema` entries in `lib/validations.ts`) with inline
  errors. Coerced numeric fields use `z.input` types so the resolver stays type-safe.
- **Status language** — `components/admin/StatusBadge.tsx` owns the palette (pending amber,
  processing/shipped blue/violet, delivered green, cancelled/refunded red/grey; in-stock green,
  low-stock amber, out-of-stock red), so a status never changes colour between pages.
- **Loading** — `app/admin/loading.tsx` streams a console skeleton for every `/admin/*` route.

## Step 7 — Database, auth, payments & image uploads

Everything below is **optional**: with no `.env` file the storefront runs exactly as it did in
Steps 1–6 (mock catalogue, in-memory orders, `password123` demo sign-in, `/public/uploads`
images). Add the credentials and each integration switches over on its own.

```bash
cp .env.example .env          # every key is optional
npx prisma generate           # only when DATABASE_URL is set
npx prisma db push            # create the tables
npm run db:seed               # 12 products · admin + 3 shoppers · 4 coupons · 5 orders
npm run db:studio             # browse the data
```

### Database (Supabase Postgres + Prisma)

- `prisma/schema.prisma` — `User`, `Product`, `Order`, `OrderItem`, `Address`, `Review`,
  `WishlistItem`, `Coupon` with the `Role`, `OrderStatus`, `PaymentMethod`, `PaymentStatus` and
  `CouponType` enums; order numbers follow `LL-2025-XXXXX`.
- `prisma/seed.ts` — the same dataset the UI shows in demo mode, including two wallet payments
  waiting for verification (with demo receipt screenshots) and one cash-on-delivery order.
- `lib/prisma.ts` — a lazy singleton that **never** throws: `getPrisma()` returns `null` and
  `withDatabase(query, fallback)` returns the mock data when Postgres is unreachable, and every
  response carries `source: "database" | "mock"` so you can see which path answered.
- Data layer: `lib/data/products.ts`, `lib/data/orders.ts`, `lib/data/coupons.ts`,
  `lib/data/users.ts`.

### Authentication (Auth.js / NextAuth v5)

- Credentials provider + bcrypt (`lib/auth.ts`), JWT sessions carrying `id` and `role`,
  `pages.signIn = "/login"`.
- `middleware.ts` protects `/dashboard/*` (any session) and `/admin/*` (ADMIN only); `/shop`,
  `/product/*`, `/login`, `/register` and `/checkout` stay public.
- Register → `POST /api/auth/register` (Zod → bcrypt → Prisma, or the demo user log) → automatic
  sign-in. Login errors are real: `unknown-email` and `wrong-password` are surfaced as friendly
  copy instead of a generic "invalid credentials".
- Demo accounts: `admin@littleluxe.com / admin123` (ADMIN) and `sarah@example.com / password123`
  (CUSTOMER); **any** email works with `password123`. The Navbar account button turns into an
  avatar + dropdown (Dashboard · Orders · Admin Console · Sign Out).

### Payments

- `lib/payments.ts` is the single source of truth: 🚚 Cash on Delivery (default, fee 0), 📱 bKash,
  📱 Nagad, 🚀 Rocket (manual transfer), 💳 SSLCommerz (**disabled — "Coming soon"**). Numbers come
  from `PAYMENT_*_NUMBERS`, falling back to the two store numbers in `lib/config.ts`.
- Wallet payments walk the customer through the transfer, show copy-to-clipboard numbers, the exact
  amount and the order number as the reference, then require a screenshot (≤2MB) plus an
  "I've completed the payment" tick before the order can be placed.
- `POST /api/orders` re-prices every line from the catalogue (a tampered client cannot set prices),
  validates stock and coupons server-side (`lib/data/coupons.ts`: minimum order, expiry, usage limit;
  the checkout's own percentage codes still resolve), then writes to Postgres or the demo log:
  **COD → CONFIRMED + UNPAID**, **wallets → PENDING + PENDING**.
- `PATCH /api/admin/orders/[orderNumber]/payment` is the operator decision — `approve` →
  CONFIRMED + PAID, `reject` → CANCELLED + FAILED, `collect-cash` → DELIVERED + PAID. The admin
  order sheet shows the payment status, the screenshot and the matching buttons.
- The confirmation page repeats the method-specific instructions: wallet numbers, the order number
  as reference, the 1–2 hour verification note and a track-order link.

### Image uploads (Cloudinary)

- `POST /api/upload` (multipart: `file`, `kind`, `folder?`) accepts JPEG/PNG/WebP ≤5MB and `.glb`
  ≤10MB, stores images in `little-luxe/products` and models in `little-luxe/models`, and returns
  `{ url, publicId, width, height, provider }`. Rate limit: 20 uploads/minute per session (IP when
  signed out).
- `DELETE /api/upload?publicId=…` removes an asset; with no Cloudinary keys the file is written to
  `.uploads/{products,models}` (git-ignored) and streamed back through `app/uploads/[...path]`, so
  uploads work out of the box — Next only serves `public/` files that existed at build time.
- The admin product form has real drag-and-drop with a progress bar, previews and delete; the
  storefront switches `ProductArtwork` (and therefore cards, gallery and quick view) to `next/image`
  as soon as a product has a real URL, and keeps the gradient + emoji tile otherwise.

### Cart persistence

- `useCartStore` is wrapped in `persist` (`little-luxe-cart`, only `items`, `skipHydration: true`)
  and rehydrated in a client effect, so the bag survives a refresh without hydration mismatches.

## Step 7.5 — Legal pages (EN + বাংলা) & image optimisation

- Five real documents, one page each: `/terms`, `/returns`, `/privacy`, `/shipping`, `/faq`.
  The copy lives in `lib/legal-content.ts` as typed `{ id, title, icon, paragraphs[] }` sections —
  English and Bengali side by side in the same file, so the two versions cannot drift apart.
- `components/layout/LegalPage.tsx` renders them: an EN | বাং gold pill toggle (instant, no
  navigation), a framer-motion accordion (every section is forced open when printing), a print
  button, the "last updated" stamp and a "Back to Home" control. Mobile-first, ≥44px targets.
- The footer's **Support** column now links the five pages (Shipping Info, Return Policy, FAQ,
  Terms & Conditions, Privacy Policy) and the Legal column's Privacy/Terms entries use the real
  routes instead of `/#` anchors.
- Images: `lib/image-optimizer.ts` builds Cloudinary delivery URLs per preset — `thumbnail` 96px,
  `card` 400×500, `detail` 800×1000, `zoom` 1600×2000 (+`dpr_auto`), `blur` 24px, `og` 1200×630 —
  plus `getResponsiveSrcSet()` (`"…/w_240…/tee.jpg 240w, …"`). Non-Cloudinary URLs (Unsplash
  leftovers, `/uploads/…`, placeholder tokens) pass through untouched.
- `components/ui/OptimizedImage.tsx` is the storefront's single image primitive: `next/image` with
  a preset-aware loader (so Next emits a genuine `srcSet`), a blurred 24px Cloudinary preview, a
  shimmer while loading, `onError` degradation and the gradient tile as the fallback. Product cards
  use `preset="card"`; the product gallery uses `detail` for the stage and `thumbnail` for the strip.
- `next.config.ts` already allowed `res.cloudinary.com` and `images.unsplash.com`; both were
  verified, so this step needed no config change.

## Next up (not built yet)

Real product photography and `.glb` models, live SSLCommerz checkout, database-backed
cart/wishlist/account sync, transactional e-mail, and background jobs for abandoned carts.

### Step 7 limitations

- Supabase/Prisma needs a network round-trip: `prisma generate`, `validate`, `format` and `db push`
  all download engine binaries from `binaries.prisma.sh`, which an offline sandbox blocks — so
  `prisma/schema.prisma` was verified by hand (brace/structure/model/delta-field checks) and the
  app's default is the mock fallback, with every Prisma call wrapped in try/catch.
- Wallets are **manual by design** — the customer transfers money and uploads a screenshot; the
  admin approves or rejects it. SSLCommerz stays a "Coming soon" card until a merchant account is
  configured (`NEXT_PUBLIC_ENABLE_SSLCOMMERZ=true` + store id).
- Uploaded files land in `.uploads/` when Cloudinary is unconfigured; on a serverless host that
  disk is ephemeral, so add the Cloudinary keys for durable storage.
- Wallet screenshots shipped with the demo are SVG receipts in `public/demo/payments/`; real
  uploads go through the same `paymentRef` field.
- Cart persistence is local (`localStorage`); merging the bag into the database on sign-in is
  prepared but not switched on.
- Admin console tables are still the seeded mock set. "Verify payment" / "Mark as paid" call the
  API **and** update the console list, which is what makes the flow demoable without a database.
- `npm run build` prints one known warning: `jose` (used by Auth.js) references `CompressionStream`
  in the Edge Runtime bundle. Only compressed JWEs are affected — we use plain signed JWTs, and the
  redirect/role behaviour is verified end to end.
- Money constants are the demo's own: the storefront is priced in dollars (free shipping over $50)
  while the client brief's `NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD=500` is available as an override —
  flip `NEXT_PUBLIC_CURRENCY=BDT` and the env value together for taka pricing.

### Step 6 limitations

- Everything is mocked and in-memory: a hard refresh returns the console to its seeded state.
- "Export CSV" downloads the current filtered rows from the browser; there is no server export.
- Product images are gradient placeholders (no uploads) and the `.glb` field only stores a filename.
- Emails, refunds and payment-gateway toggles are decorative — they toast instead of calling out.
- Low stock follows each product's own threshold (default 20 in the seed, 10 for new products);
  that is what makes the dashboard read "3 products running low" plus one out-of-stock item.

### Step 5 limitations

- Account data is mock and in-memory: a hard refresh restores the demo values (including the five
  saved wishlist pieces, which the dashboard loads once per session).
- "Delete Account", "Change Photo", "Contact Support" and "Redeem" are intentionally inert — they
  say so via toast rather than pretending to work.
- Orders, notifications and addresses are seeded per session; nothing is written back to a server.
- Invoice printing relies on the browser's print dialog (the "Print Invoice" button).

### Step 4 limitations

- Cart, wishlist and checkout state are in-memory (no `localStorage`): a hard refresh empties the bag.
- Payment is fully mocked — no gateway, no API route, nothing is charged.
- Coupons are validated against a client-side table (`lib/cart.ts`), not server-side.
