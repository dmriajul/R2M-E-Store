# Empty-state handling & homepage spacing — incident report

**Status:** fixed, verified against a running dev server and a production build.
**Scope:** `/shop`, `/collections`, `/` (home), the shared data layer behind them.
**Shipped in:** branch `arena/2e6a4897-r2m-e-store`.

---

## 1. Root cause

### Issue #1 — "We'll be right back" on /shop and /collections

The maintenance card was **not** a query bug and **not** a missing-product bug. It
was a *state-modelling* bug: a store that had never been given a database was
treated exactly like a store whose database had just fallen over.

Three facts combined:

1. `lib/data/products.ts` reads through `requireDatabase()`, which throws
   `DatabaseUnavailableError` both when `DATABASE_URL` is **missing** and when a
   query **fails**. The distinction existed internally (`getPrisma()` returns
   `null` for "unconfigured") but was erased before the page saw it.
2. `app/(shop)/shop/page.tsx` caught that single error type and replaced the
   whole catalogue — header, filters, grid — with `<CatalogueUnavailable />`
   ("We'll be right back"), including for the unconfigured case.
3. `app/(shop)/collections/page.tsx` was a bare `redirect("/#collections")`, so
   the "collections" destination could never show a real catalogue at all.

Proof from production at the time of the report:

```
GET https://2r-m-store.vercel.app/api/health
{"mode":"unconfigured","integrations":{"database":"unconfigured", ...}}

GET https://2r-m-store.vercel.app/api/products
{"error":"The catalogue is temporarily unavailable...","success":false}   (503)
```

`mode: "unconfigured"` is the smoking gun: no `DATABASE_URL` was set on the
deployment, so the catalogued pages rendered an outage card. The Vercel project
(`prj_uzRHRO1wz8Hj7d2f1B308k3V9E2H`, env listed via the API) has exactly one
environment variable — `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. There is no
`DATABASE_URL` in any target.

Two secondary faults amplified it:

- When the database *is* empty (as opposed to missing), the shop grid's empty
  state was plain text with a large emoji — visually far below the rest of the
  storefront, which is why it read as broken.
- `getPrisma()` also returns `null` when the Prisma **client cannot be built**,
  so a deploy where `prisma generate` failed looked identical to a missing
  connection string.

### Issue #2 — the black void under the stats band

Two independent causes stacked:

1. **Doubled section padding.** Every section carried `py-24 lg:py-32`
   (96px/128px *per side*). Between two sections that is 192px mobile / 256px
   desktop of empty space before any content. With the product sections empty,
   the page became: gap → lone empty state → gap → 608px campaign banner → gap
   → stats → gap → newsletter, i.e. mostly black.
2. **Reveal animations that could stay invisible.** `<Reveal />` armed
   `opacity: 0` from a `useEffect` and only un-hid itself when an
   `IntersectionObserver` reported `isIntersecting`. If the element was already
   **above** the viewport when the effect ran (deep link, refresh mid-page,
   anchor jump, a screenshot viewport that expands to the whole document), the
   observer never fired and the section stayed at `opacity: 0` **forever**. The
   full-page screenshot in `docs/screenshots/before-home-desktop.jpg` shows the
   result: "New Arrivals" heading missing, product area blank, a lone empty
   panel floating, then a long black run before the campaign banner.

   Note the threshold was `0.2` — for tall sections (the 800px category
   carousel) 20% visibility is 160px of scroll before anything appears, which is
   why sections also felt "late".

### Issue #3 — design drift from the premium original

Measured against the last good layout (git history: `StatsSection` +
`py-24 lg:py-32` sections before the empty-state refactor):

- The hero is `min-h-[100svh]` by design — correct, unchanged.
- Nothing had `min-h-screen` or `py-48`; the drift was the *uniform* doubling of
  the rhythm token (see above) plus the campaign banner growing to
  `min-h-[38rem]` with a second `lg:py-32` inside it.
- The stats band had lost the closer's breathing room and the four benefit
  cards were pushed 48px away from their heading.

---

## 2. What changed

### Data layer — `lib/data/products.ts`

New page-facing API that models the four real states instead of one error:

```ts
export type CatalogueStatus = "ready" | "empty" | "unconfigured" | "unavailable";

export async function getCatalogue(query?): Promise<{ products, status }>
```

| Status | Meaning | Surface |
| --- | --- | --- |
| `ready` | rows exist | products render |
| `empty` | database answered, 0 active rows | premium `CatalogueEmptyState` |
| `unconfigured` | no `DATABASE_URL` | premium `CatalogueEmptyState` in "opening soon" mode |
| `unavailable` | configured, read failed | `CatalogueUnavailable` (the only maintenance state) |

`getCatalogue()` never throws for the two failure states (it logs one
diagnostic per state per minute and resolves), so a fresh deploy can no longer
fall into the error boundary. `listProducts()` keeps its throw-on-unavailable
contract — the API routes and tests depend on it.
`isCatalogueOutage(status)` is the single predicate pages use to decide
"maintenance vs. everything else".

### Empty state — `components/shop/CatalogueEmptyState.tsx` (new)

Premium panel in the storefront's dark/gold language: glass surface, gold halo +
hairline, emblem, eyebrow → title → rule → copy, a real **Notify Me** capture
(acknowledges locally until the newsletter endpoint lands), a secondary
**Browse Categories** link, and a perks line. Three variants:

- `default` — shop grid / collections page / product rails;
- `compact` — inside a section that already has its own heading;
- `filter` — no products match the *filters*; primary action is **Clear Filters**.

`mode="setup"` swaps only the copy ("The catalogue is almost live" / "Opening
soon") — same layout, never an error voice.

`components/sections/CatalogueEmptyState.tsx` was removed; its two call sites
(`NewArrivalsGrid`, `FeaturedCarousel`) now import the shop component.

### Maintenance notice — `components/shop/CatalogueUnavailable.tsx`

Kept, but now rendered **only** for `status === "unavailable"`. Rewritten as a
client component with an honest **Try Again** (`router.refresh()`, busy state)
and a **Contact us** fallback; `variant="section"` for the home page.

### `/shop` — `app/(shop)/shop/page.tsx`

Uses `getCatalogue()`. Empty/unconfigured keep the header, the filter bar and
the page layout, with the premium panel inside the grid. `ShopCatalog` gained a
`catalogueStatus` prop so it can word the panel correctly.

### `/collections` — `app/(shop)/collections/page.tsx`

Was `redirect("/#collections")`; now a real page: header, jump-to-collection
chips, one row per category with cards and a per-collection link into `/shop`.
Same four-state handling as `/shop`. `NAV_LINKS` (and the Bengali menu) now
point at `/collections`; `/collections` was added to `sitemap.ts`.

### Home — `app/(shop)/page.tsx`

- All reads go through `getCatalogue()`; the maintenance notice is driven by
  `status === "unavailable"` only.
- `FeaturedCarousel` renders only when there are featured rows — an empty
  catalogue no longer shows two stacked empty panels.
- Doc comment rewritten around the new contract.

### Spacing — every home page section

| Token | Before | After |
| --- | --- | --- |
| Section wrapper | `py-24 lg:py-32` (96/128 per side) | `py-16 lg:py-20` (64/80 per side) |
| Gap between two sections | 192px / 256px | **128px / 160px** |
| Heading → grid / rail | `mt-12` | `mt-10` |
| Benefit cards → stats | `mt-10` | `mt-10` (kept) |
| Stats → closer | `mt-10` | `mt-8` |
| Campaign stage | `min-h-[26/32/38rem]` + inner `lg:py-32` | `min-h-[20/24/28rem]` + inner `lg:py-20` |

Applied to `FeaturesSection`, `NewArrivalsGrid`, `FeaturedCarousel` (both
branches), `ShopByCategory`, `NewsletterSection`, `CampaignBanner`,
`FeaturedProducts`, `CatalogueUnavailable`. Nothing uses `min-h-screen`, and the
only full-viewport surface remains the hero (`100svh`, intentional).

Result for an empty catalogue (1440px): page height 5,005 → **4,877**, and the
section sequence reads continuously: hero → marquee → categories → new arrivals
(with premium panel) → campaign → Mukra Standard + stats → newsletter → footer.

### Image visibility — `components/ui/OptimizedImage.tsx`

While verifying at 768px a second fail-visible bug surfaced (visible in the
first tablet capture, where every category tile was an empty dark rectangle):

- The `<img>` shipped with `opacity-0` and was only revealed by an `onLoad`
  React handler. A **cached** image can finish loading before React attaches the
  handler, so `onLoad` never fires and the photo stays invisible behind the
  skeleton forever. Reproduced deterministically with `#collections` tiles.
- Fix: the image now paints at full opacity as soon as the browser has it; the
  plain dark placeholder sits **behind** it instead of masking it. No JS is
  required for a photo to be visible, and a 404 still swaps to the branded
  fallback through `onError`.

This is the same class of failure as the reveal bug: content that only becomes
visible because an effect ran.

### Reveal robustness — `components/sections/Reveal.tsx`

- Never arm elements that are already on screen **or already above it**
  (`rect.bottom <= 0`).
- `threshold: 0` with `rootMargin: "0px 0px -8% 0px"` — reveals start when an
  element edges in, not when 20% of it is visible.
- A reveal is one-way: once shown it stays shown, so scrolling back up can't
  blank a section.
- Still fail-visible: no JS, or reduced motion, and the content is simply there.
  (A CSS-only `animation-timeline: view()` version was prototyped and rejected:
  it re-hides content when you scroll up, and expanded screenshot viewports
  resolve it inconsistently.)

### Copy / i18n — `lib/utils.ts`

New EN + BN keys for the catalogue empty state, filter empty state, and the
maintenance notice, so the Bengali toggle covers every new surface.

### Tests

- `tests/catalogue-states.test.ts` (new, 6 cases): ready / empty / draft-only →
  empty / unconfigured / configured-but-failing → unavailable / `listProducts`
  still throws for the API contract.
- `tests/http-customer-journey.ts`: `/collections` is asserted as a real 200
  page instead of a redirect.
- `npm test` → **136 tests, 0 failures**. `npx tsc --noEmit` → clean.
  `npx eslint .` → clean. `npx next build` → 39 routes, 0 errors.
Browser verification (Chromium 140, 390/768/1440): no page errors, no failed
image requests, every section visible after a full-page scroll.

---

## 3. Files changed

**Created**

- `components/shop/CatalogueEmptyState.tsx`
- `tests/catalogue-states.test.ts`
- `docs/EMPTY_STATE_AND_SPACING_FIX.md` (this report)
- `docs/screenshots/*.jpg` (before/after evidence)

**Modified**

- `app/(shop)/page.tsx`
- `app/(shop)/shop/page.tsx`
- `app/(shop)/collections/page.tsx`
- `app/globals.css` (reveal comments/robustness)
- `app/sitemap.ts`
- `components/layout/Navbar.tsx`
- `components/sections/CampaignBanner.tsx`
- `components/sections/FeaturedCarousel.tsx`
- `components/sections/FeaturedProducts.tsx`
- `components/sections/FeaturesSection.tsx`
- `components/sections/NewArrivalsGrid.tsx`
- `components/sections/NewsletterSection.tsx`
- `components/sections/Reveal.tsx`
- `components/sections/ShopByCategory.tsx`
- `components/shop/CatalogueUnavailable.tsx`
- `components/shop/ShopCatalog.tsx`
- `components/ui/OptimizedImage.tsx`
- `lib/data/products.ts`
- `lib/site.ts`
- `lib/utils.ts`
- `tests/http-customer-journey.ts`
- `docs/PRODUCTION_CATALOGUE.md`

**Deleted**

- `components/sections/CatalogueEmptyState.tsx` (superseded by the shop
  component)

---

## 4. Before / after

All images are in `docs/screenshots/` (full-page, 1440×1000 desktop, 390×844
mobile, 768×1024 tablet).

| View | Before | After (empty DB) | After (with products) |
| --- | --- | --- | --- |
| Home | `before-home-desktop.jpg` — missing New Arrivals, blank runs | `after-home-desktop.jpg` | `with-products-home-desktop.jpg` |
| Home (mobile) | `before-home-mobile.jpg` | `after-home-mobile.jpg` | — |
| Home (tablet) | — | `after-home-tablet.jpg` | — |
| /shop | `before-shop-desktop.jpg` — "We'll be right back" | `after-shop-desktop.jpg` — premium panel + full layout | `with-products-shop-desktop.jpg` — 8 cards |
| /shop (mobile) | `before-shop-mobile.jpg` | `after-shop-mobile.jpg` | — |
| /shop (tablet) | — | `after-shop-tablet.jpg` | — |
| /collections | `before-collections-desktop.jpg` — redirect to home | `after-collections-desktop.jpg` | `with-products-collections-desktop.jpg` |

The "with products" shots were captured with a local Prisma-compatible fixture
(8 products, injected through the `globalThis.prisma` seam the test suite
already uses) — the app code path is the real one; only the rows are synthetic.

---

## 5. Database verification steps

Run these against the real Supabase project to prove where the store stands.

```bash
# 1. Is a database configured on the deployment at all?
curl -s https://<deployment>/api/health | jq '.data.mode'
#   "unconfigured" → set DATABASE_URL (see §6). Nothing else matters until then.
#   "live"         → continue.

# 2. Connectivity + schema probe
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/api/ready   # 200 = ok

# 3. Are there active products?
psql "$DATABASE_URL" -c "select count(*) filter (where active) as active,
                                count(*) as total from \"Product\";"

# 4. If the count above is 0, the storefront is correct to show the premium
#    empty state. Add products (admin console → Products → Add Product), or:
psql "$DATABASE_URL" -c "update \"Product\" set active = true where active = false;"
```

RLS: the storefront reads through Prisma with the database's service
credentials, so Supabase RLS policies on `Product` do **not** gate the
storefront — they gate the anon/authenticated PostgREST roles. The policies in
`supabase/migrations/005_rls_policies_catalog.sql` already allow public reads of
active rows should you ever query through PostgREST.

---

## 6. Deployment

The only *required* step to make real products appear is setting the connection
string — the code fix alone removes the false error state.

1. Push this branch and merge (or deploy the branch to preview).
2. In Vercel → project → **Settings → Environment Variables**, add for
   Production (and Preview):
   - `DATABASE_URL` — Supabase pooled URI (port 6543) with `?pgbouncer=true&connection_limit=1`
   - `DIRECT_URL` — Supabase direct URI (port 5432), used by migrations
   - `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (auth)
   - `NEXT_PUBLIC_SITE_URL`
   - optional: `CLOUDINARY_*`, `MAILJET_*`, Turnstile keys
3. Apply the schema once: `npx prisma db push` (or `prisma migrate deploy`),
   then seed the first admin:
   `ADMIN_NAME=… ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:seed`.
4. Redeploy. `/api/health` must report `mode: "live"`.
5. Add products in Admin → Products; `/shop`, `/collections` and the home page
   pick them up on the next request (`force-dynamic`).
6. Smoke test: `/` (no blank bands), `/shop` (empty state before products,
   grid after), `/collections` (200, not a redirect), `/api/products` (200 once
   configured).

Nothing in this change requires a schema migration.
