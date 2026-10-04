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

## Next up (not built yet)

Database, real product photography and `.glb` models (`public/models`), server-side coupon
validation, real returns/refunds, admin authentication, and cart/wishlist/account persistence.

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
