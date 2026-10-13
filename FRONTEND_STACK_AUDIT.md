# Front-End Tech Stack & UI Architecture Audit — R2M-E-Store (MUKRA)

Audited against the working tree at commit `6f3806a` on branch `arena/881cf859-r2m-e-store`.
Versions below are the **installed** versions read from `node_modules`, not the semver ranges in `package.json`.

---

## 1. Core Framework & Web Stack

| Tool | Version | Purpose | Primary locations |
|---|---|---|---|
| **Next.js** | 15.5.27 | Framework — **App Router only** (no `pages/` directory exists) | `app/`, `next.config.ts`, `middleware.ts` |
| **React** | 19.1.0 | UI runtime | throughout |
| **React DOM** | 19.1.0 | DOM renderer | `app/layout.tsx` |
| **TypeScript** | 5.9.3 | Types. `strict`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch` all on | `tsconfig.json` |
| **ESLint** | 9.x | Linting via `eslint-config-next` (`core-web-vitals` + `typescript`); extra rules: `no-explicit-any: error`, `consistent-type-imports` | `eslint.config.mjs` |
| **Prisma** | 6.19.3 | Data layer (server only, lazy-loaded; degrades to mock data) | `prisma/schema.prisma`, `lib/prisma.ts`, `lib/data/*` |
| **NextAuth (Auth.js)** | 5.0.0-beta.32 | Session + route protection | `lib/auth.ts`, `lib/auth.config.ts`, `middleware.ts`, `components/providers/AuthProvider.tsx` |

### Routing & route groups

```
app/
├── (shop)/     → storefront chrome (Navbar + Footer + PageTransition + BackToTop)
│                 home, /shop, /product/[id], /checkout, /dashboard/*, legal pages
├── (auth)/     → chrome-free auth shell: /login, /register, /forgot-password
├── admin/      → 9-page admin console (own layout + loading)
├── api/        → 15 route handlers
└── root        → layout, globals.css, error/loading/not-found, robots, sitemap,
                  opengraph-image, /offline, /uploads/[...path]
```

### SSG / SSR configuration

- **Three storefront pages are explicitly `force-dynamic`** (SSR on every request):
  - `app/(shop)/page.tsx` — home
  - `app/(shop)/shop/page.tsx`
  - `app/(shop)/product/[id]/page.tsx`
  - plus `app/sitemap.ts` (needs live product data)
- **No `generateStaticParams` anywhere** → no SSG for `/product/[id]`; it re-renders per request.
- Everything else is statically prerendered — build output reports **38/38 static pages**.
- All API routes pin `export const runtime = "nodejs"` (Prisma/bcrypt require Node APIs).
- `output: "standalone"` in `next.config.ts` for Docker/self-hosting.
- `middleware.ts` (87.6 kB, edge-safe Auth.js config) guards `/dashboard/*` and `/admin/*`.

### Server / Client split

| | Count |
|---|---|
| Files marked `"use client"` | **112 of 173** `.ts`/`.tsx` |
| Files marked `"use server"` | **0** |

The app is **client-heavy** — most interactive surfaces (cart, checkout, admin, dashboard) are client components. Server components are used deliberately where it pays: `JsonLd`, `opengraph-image`, `sitemap`, `robots`, and the page shells that fetch data.

> **Gap:** there are **zero** `next/dynamic` / `React.lazy` calls, so code-splitting is limited to Next's automatic per-route splitting. Large client components (e.g. `components/admin/ProductForm.tsx`, 1100+ lines, and the admin console generally) ship whole to any visitor who opens them.

---

## 2. UI & Component Libraries

| Tool | Version | Purpose | Primary locations |
|---|---|---|---|
| **shadcn/ui** | — | Component *pattern* (not a runtime dep). `components.json` → style `new-york`, `rsc: true`, `tsx: true`, base `zinc`, `cssVariables: true`, icon library `lucide`. Components are **vendored** into `components/ui/` | `components.json`, `components/ui/*` |
| **Radix UI** | 1.6.7 | Headless accessible primitives — accessed through the **unified `radix-ui` package**, not individual `@radix-ui/react-*` packages | 9 files in `components/ui/` |
| **Tailwind CSS** | 4.3.3 | Utility CSS — **v4 CSS-first config** | `app/globals.css` |
| **@tailwindcss/postcss** | 4.x | PostCSS plugin (the only one configured) | `postcss.config.mjs` |
| **tw-animate-css** | 1.4.0 | Radix enter/exit animation utilities | imported at `app/globals.css:2` |
| **class-variance-authority** | 0.7.1 | Variant → class mapping | `components/ui/button.tsx`, `components/ui/badge.tsx` |
| **tailwind-merge** + **clsx** | 3.7.0 / 2.1.1 | `cn()` helper that merges class names and resolves Tailwind conflicts | `lib/utils.ts`, used everywhere |

### Radix primitives in use

Accordion, Avatar, Dialog, DropdownMenu, Separator, Switch, and `Slot` (button/badge `asChild`).
`components/ui/sheet.tsx` is a **Dialog re-skin** for slide-in panels.

Consumption: `button` (37 files), `dialog` (13), `input` (12), `badge` (10), `separator` (8), `sheet` (7), `dropdown-menu` (4), `switch` (4), `skeleton` (2), `accordion` (1), `avatar` (1). **`card.tsx` is vendored but unused (0 imports).**

### Styling architecture

- **There is no `tailwind.config.js` / `tailwind.config.ts`** — Tailwind v4 config lives entirely in CSS (`components.json` sets `"tailwind": { "config": "" }`).
- `app/globals.css` (555 lines) is the design system:
  - `@import "tailwindcss"` + `@import "tw-animate-css"`
  - `:root, .dark { … }` — ~70 CSS custom properties. Palette is *Midnight Navy* (`#050816`) + *Royal Gold* (`#D4AF37`) with cyan/lavender/coral accents, glass surfaces, chart colors.
  - `@theme inline { … }` — maps the CSS vars into Tailwind's `--color-*`, `--radius-*`, `--font-*`, `--animate-*` namespaces.
  - `@layer components` — 12 bespoke classes: `.glass`, `.glass-strong`, `.glass-soft`, `.text-gradient-gold`, `.hairline-gold`, `.glow-gold`, `.glow-gold-hover`, `.glow-cyan`, `.shadow-playful`, `.shadow-playful-hover`, `.prose-kids`, `.emoji-pop`, `.shimmer-gold`, `.glass-pill-glow`.
  - `@layer utilities` — `.font-bengali` (Noto Sans Bengali / Hind Siliguri fallback stack).
  - 7 hand-written `@keyframes` (`shimmer`, `float`, `marquee`, `marquee-left`, `marquee-right`, `glow-pulse`, `gold-shimmer`, `gold-breathe`) exposed as `--animate-*` tokens.
  - An `@media print` block for invoices.
- **No CSS Modules, no Sass, no styled-components, no emotion** anywhere.

---

## 3. Animations & Visual Effects

| Tool | Version | Files | Purpose | Primary locations |
|---|---|---|---|---|
| **Framer Motion** | 14.0.0 | **41** | Primary motion engine | see below |
| **Lucide React** | 1.52.0 | **84** | Icon set (the only icon library) | throughout |
| **tw-animate-css** | 1.4.0 | 1 | Radix open/close transitions | `app/globals.css` |
| **Embla Carousel** | 8.6.0 | **1** | Category carousel | `components/sections/ShopByCategory.tsx` |
| **GSAP** | 3.15.0 | **0** | ⚠️ **Declared but never imported** — dead dependency | — |

### How Framer Motion is used

| API | Uses | Where |
|---|---|---|
| `AnimatePresence` | 66 | enter/exit transitions across the app |
| `MotionConfig reducedMotion="user"` | 4 | global reduced-motion opt-out |
| `useTransform` | 4 | scroll-linked values |
| `whileHover` | 4 | micro-interactions |
| `useScroll` / `useMotionValueEvent` | 2 each | scroll-driven storytelling (`VirtualBoutique`, currently flag-disabled) |
| `whileInView` | 2 | scroll reveals |
| `useInView` | 2 | stat counters (`StatsSection`) |
| `layoutId` | 2 | shared-element transitions |

Key motion components:
- **`components/sections/Reveal.tsx`** — the workhorse scroll-reveal wrapper (opacity + 40px Y, `once`, `amount: 0.2`), honouring `prefers-reduced-motion`.
- **`components/providers/PageTransition.tsx`** — 200 ms fade on route change, keyed on `pathname`.
- **`components/checkout/Confetti.tsx`** — 48-particle gold/pink/cyan burst on order confirmation, fully hand-rolled with `motion` (no confetti library).
- **`components/sections/BrandMarquee.tsx`** / **`FeaturedProducts.tsx`** — infinite scrolling rows built from **CSS keyframes**, not JS.
- **`components/ui/CursorDot.tsx`** — desktop-only custom pointer flourish, inert on touch.

**Accessibility:** `hooks/useMediaQuery.ts` exposes `usePrefersReducedMotion()`, and essentially every animated component consults it (plus the global `MotionConfig reducedMotion="user"`).

---

## 4. Key Interactive & Functional Features

### Cart / e-commerce state (Zustand 5.0.15 — six stores in `store/`)

| Store | Persistence | Consumed by | Notes |
|---|---|---|---|
| `useCartStore` | `persist` → `localStorage`, `partialize: {items}`, **`skipHydration: true`** | 13 files | Totals are recomputed on rehydrate; the badge never mismatches SSR |
| `useLanguageStore` | `persist` → localStorage, `partialize: {language}`, `skipHydration: true` | 13 files | Powers the EN ⇄ BN toggle |
| `useCheckoutStore` | none (session) | 9 files | Multi-step checkout state |
| `useWishlistStore` | **none** — session-scoped | 6 files | Docstring notes persistence is pending the accounts step |
| `useAdminStore` | none | 16 files | Admin console state |
| `useDashboardStore` | none | 10 files | Dashboard state |

`skipHydration` on the cart is deliberate: `components/providers/CartHydration.tsx` rehydrates after mount, so the server renders an empty bag and there is **no hydration mismatch** on the cart badge.

Supporting logic: `lib/cart.ts` (totals/shipping), `lib/shop.ts` (filters/sort), `lib/payments.ts`.

### Forms, validation, feedback

| Tool | Version | Files | Purpose |
|---|---|---|---|
| **react-hook-form** | 7.89.0 | 13 | Form state |
| **@hookform/resolvers** | 5.9.1 | 13 | Zod bridge |
| **zod** | 3.25.76 | 14 | Schemas — `lib/validations.ts` (712 lines) |
| **sonner** | 2.0.8 | 35 | Toasts, mounted once via `components/providers/AppToaster.tsx` |

### i18n

Hand-rolled **EN ⇄ BN**: `useLanguageStore` + `t()` / `translateCategory()` in `lib/utils.ts`, plus a `.font-bengali` utility. No `next-intl`, `react-i18next`, or i18n routing.

### PWA — ⚠️ manifest-only, no service worker

| Present | Absent |
|---|---|
| `public/manifest.json` (name, icons incl. `maskable`, `display: standalone`, theme `#0A3622`, a "Shop Now" shortcut) | **No service worker** — no `sw.js`, no Workbox, no `next-pwa` |
| `manifest` + `appleWebApp` + `icons` in `app/layout.tsx` metadata | No offline caching, no background sync, no install prompt |
| `export const viewport` with `themeColor`, `colorScheme: dark` | |
| `app/offline/page.tsx` — a friendly offline screen | **but it is unreachable**: with no SW, nothing routes failed navigations to it (the file's own docstring says so) |
| `scripts/make-pwa-icons.py` — icon generator | |

### Open Graph / SEO

| Feature | Location |
|---|---|
| **OG image** via `next/og` `ImageResponse` (1200×630 Satori card, built at build time) | `app/opengraph-image.tsx` |
| Site-wide `openGraph` + `twitter` (summary_large_image), `robots`, `keywords`, `metadataBase`, title template | `app/layout.tsx` |
| Per-page `Metadata` exports | every route |
| **JSON-LD** builders — Organization, Product, Breadcrumb, FAQ | `lib/seo.ts` + `components/seo/JsonLd.tsx` (a server component, so structured data lands in the initial HTML) |
| `sitemap.xml` (static pages + live product URLs, `force-dynamic`) | `app/sitemap.ts` |
| `robots.txt` (disallows `/admin/`, `/api/`) | `app/robots.ts` |

### Analytics

`@next/third-parties` → `GoogleAnalytics`, rendered **only when `NEXT_PUBLIC_GA_ID` is set** (`app/layout.tsx`), with `lib/analytics.ts` wrapping `window.gtag` for custom events and a `components/CookieConsent.tsx` consent gate.

### Bot protection

Cloudflare **Turnstile** via `@marsidev/react-turnstile` → `components/TurnstileCaptcha.tsx`, wired into `components/layout/NewsletterForm.tsx`; server side in `lib/turnstile.ts`.

### Special components

| Type | Component | Built on |
|---|---|---|
| **Overlays** | `components/ui/WelcomeOverlay.tsx` ⚠️ *currently flag-disabled* | framer-motion `AnimatePresence` + sessionStorage |
| | `components/CookieConsent.tsx` | framer-motion |
| **Modals** | `components/product/QuickViewDialog.tsx`, `components/layout/SearchDialog.tsx` | Radix Dialog |
| | `components/product/ProductGallery.tsx` lightbox | Radix Dialog |
| **Sheets / drawers** | `components/layout/CartSheet.tsx`, `Navbar` mobile menu, `components/shop/FilterBar.tsx`, `components/dashboard/DashboardShell.tsx`, admin detail sheets | Radix Dialog (Sheet) |
| **Sliders / carousels** | `components/sections/ShopByCategory.tsx` — category grid | **Embla Carousel** |
| | `components/product/ProductGallery.tsx` — thumbnails + **custom zoom/pan/pinch** (1×–3×) | hand-rolled pointer events |
| | `components/sections/FeaturedProducts.tsx` — dual-row product marquee | CSS keyframes |
| | `components/sections/VirtualBoutique.tsx` — scroll-driven showcase + image carousel ⚠️ *flag-disabled* | framer-motion `useScroll` |
| **Category grid** | `components/sections/ShopByCategory.tsx` | Embla + `public/images/categories/*.jpg` |
| **Charts** | `components/admin/BarChart.tsx`, `KpiCard`, `RevenuePanel`, `BestsellersPanel` | **hand-rolled with framer-motion** — no Recharts/Chart.js |
| **Data table** | `components/admin/DataTable.tsx` | hand-rolled — no TanStack Table |
| **Other** | `StarRating`, `ReviewSection`, `CheckoutStepper`, `OrderTimeline`, `PasswordStrength`, `MarkdownDescriptionEditor`, `BackToTop`, `SkipToTop`, `CursorDot` | — |

---

## 5. Performance & Asset Optimizations

### Fonts

- **`next/font/local`** self-hosts a **variable Inter** woff2 (`app/fonts/inter-latin-variable.woff2`, latin subset only) — the build never contacts Google Fonts.
- Configured with `display: "swap"` (no FOIT), **`preload: true`** (inlined `<link rel="preload">`), and an explicit `fallback` stack.
- Exposed as the `--font-inter` CSS variable, wired into Tailwind's `--font-sans`.
- `@fontsource-variable/inter` is a **devDependency** — it is only the source the woff2 was copied from.
- Bengali copy renders in the system/Noto stack via `.font-bengali` (Inter ships latin only).

### Images & media

- **`next/image` in 15 files**, always through wrappers:
  - `components/ui/OptimizedImage.tsx` — 5 named **Cloudinary presets** (`thumbnail` 100px/q70, `card` 400×500/q80, `detail` 800×1000/q85, `zoom` 1600×2000/q90, `blur` 40px/q10), a default responsive `sizes` string, `priority → loading="eager"`, and a CSS-gradient/emoji fallback when the image is missing or errors.
  - `components/product/ProductArtwork.tsx` — `IMAGE_SIZES` map + `priority` pass-through.
- **`lib/image-optimizer.ts`** — pure string math (no SDK, no network) that builds Cloudinary transform URLs and `srcSet` breakpoints; safe to import from server, client, or route handlers.
- **`lib/cloudinary.ts`** — server-side uploads (8 files touch Cloudinary).
- `next.config.ts` images: `formats: ["image/avif", "image/webp"]`, `remotePatterns` for `res.cloudinary.com`, `images.unsplash.com`, `images.pexels.com`, `dangerouslyAllowSVG: true`, `contentDispositionType: "attachment"`.
- **Hero video**: `public/hero-fashion.mp4`, rendered with a plain `<video>` in `components/sections/HeroSection.tsx` (source overridable through admin hero settings). ⚠️ A raw ~full-width video is the heaviest asset on the home page and is not preloaded or poster-gated.

### Build / delivery

- `experimental.optimizePackageImports: ["lucide-react", "framer-motion"]` — barrel-file optimization for the two biggest icon/motion imports.
- `compress: true`, `reactStrictMode: true`, `poweredByHeader: false`, `output: "standalone"`.
- Granular `Cache-Control` headers in `next.config.ts`: immutable (1 yr) for `/_next/static`, `/icons`, `/demo`, `/images`; `s-maxage=60, stale-while-revalidate=300` for HTML pages; `no-store` for `/api/auth/*`, `/api/admin/*`, `/api/orders`, `/api/health`.
- Security + `X-Robots-Tag: noindex` headers for `/admin`, `/dashboard`, `/checkout`, `/offline`.
- `vercel.json` mirrors production headers.

---

## Notable Gaps & Risks

| # | Finding | Impact |
|---|---|---|
| 1 | **GSAP 3.15.0 is installed but imported in 0 files** | Dead dependency; ~70 kB of unused install surface and a misleading signal about the animation stack. Safe to remove. |
| 2 | **PWA is manifest-only — no service worker** | No offline capability, no install-time caching; `app/offline/page.tsx` is unreachable dead code. Adding Workbox is the acknowledged follow-up (see `DEPLOYMENT.md`). |
| 3 | **No code-splitting beyond route level** (0 `next/dynamic` calls) | Admin console (`ProductForm` 1100+ lines, `DataTable`, charts) and Framer Motion ship whole to whoever opens them. |
| 4 | **Home, `/shop`, and `/product/[id]` are all `force-dynamic`** | Every visit re-runs the data layer. With `generateStaticParams` + `revalidate`, the product pages are strong SSG/ISR candidates. |
| 5 | **112 of 173 files are `"use client"`** | A large hydration surface for a storefront. worth reviewing which sections genuinely need client JS. |
| 6 | **`components/ui/card.tsx` is vendored but never imported** | Dead code from the shadcn scaffold. |
| 7 | **Hand-rolled admin charts, data table, and confetti** | No Recharts/Chart.js/TanStack Table/canvas-confetti — consistent with the "no extra runtime" approach, but more code to maintain. |
| 8 | **i18n is hand-rolled (EN/BN)** with no URL-based locale routing | Fine for two locales, but no per-locale SEO URLs or SSR'd translations. |
| 9 | **`dangerouslyAllowSVG: true`** with `contentDispositionType: "attachment"` | Mitigated, but still worth confirming only trusted sources can reach the image optimizer. |
| 10 | **Wishlist is session-only** — lost on refresh | Noted as intentional in the store docstring, pending the accounts/backend step. |
