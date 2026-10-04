# Deploying Little Luxe 🚀

A complete, copy-pasteable runbook: from an empty GitHub repo to a live store on
your own domain. Total time on a good connection: **about 40 minutes**, most of
it waiting for Supabase and Cloudinary accounts.

> **Short on time?** Steps 1–5 alone give you a fully working store on
> `*.vercel.app` running in **demo mode** — mock catalogue, in-memory orders and
> local image storage. Steps 6–9 switch it over to the real database, real
> uploads and real payments. You can do them in any order, later.

---

## 1. Push to GitHub

```bash
git init                          # if this isn't a repo yet
git add -A
git commit -m "feat: Little Luxe storefront"
git branch -M main
git remote add origin git@github.com:<you>/little-luxe.git
git push -u origin main
```

Confirm the branch is green in CI-terms only after step 4 — there is no CI
workflow to configure, Vercel builds on push.

---

## 2. Connect the repo to Vercel

1. Go to <https://vercel.com/new> and pick **Import Git Repository**.
2. Choose the repo you just pushed.
3. Vercel detects the framework automatically:
   - **Framework preset:** Next.js
   - **Build command:** `npm run build` (from `vercel.json`)
   - **Output directory:** `.next`
   - **Node version:** 20.x or 22.x
4. Leave the environment variables empty for now — click **Deploy**.

The first build takes ~2 minutes. When it finishes you get a live URL like
`https://little-luxe-xyz.vercel.app`. Everything works in demo mode.

> **Region:** `vercel.json` pins `regions: ["sin1"]` (Singapore) — the closest
> Vercel region to Bangladesh, typically 40–70 ms faster for Dhaka shoppers than
> the default US region.

---

## 3. Add environment variables

Vercel → **Project → Settings → Environment Variables**. Add them in this order
and redeploy after each group so you can see exactly what changed:

| Order | Variable group | Effect |
| --- | --- | --- |
| 1 | `NEXT_PUBLIC_SITE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Correct canonical URLs + secure sessions |
| 2 | `DATABASE_URL`, `DIRECT_URL` | Real data instead of the mock catalogue |
| 3 | `CLOUDINARY_*` | Uploads move from local disk to the CDN |
| 4 | `PAYMENT_*`, `SSLCOMMERZ_*` | Wallet numbers and the card gateway |

`.env.production.example` in the repo has every key with comments — copy it into
the Vercel UI field by field.

Generate the auth secret with:

```bash
openssl rand -base64 32
```

---

## 4. Deploy

Every push to `main` deploys automatically. To deploy a branch manually:

```bash
npx vercel --prod            # or: npx vercel for a preview
```

**Post-deploy smoke test** — five minutes, catches 95% of configuration drift:

```bash
BASE=https://your-domain.com
for p in / /shop /faq /shipping /returns /terms /privacy /login /register /sitemap.xml /robots.txt; do
  printf "%-16s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")"
done
curl -s "$BASE/api/health"                      # mode, database, cloudinary, payments
curl -s "$BASE/manifest.json" | head -5         # PWA manifest
curl -s "$BASE/robots.txt"                      # sitemap line present
```

Expect `200` everywhere, `/admin` and `/dashboard` returning `307` → `/login`
when signed out, and `"mode":"demo"` until step 6 is done.

---

## 5. Connect your domain

1. Vercel → **Project → Settings → Domains → Add**.
2. Enter `littleluxe.com` and `www.littleluxe.com`.
3. At your registrar (Namecheap / GoDaddy / Cloudflare DNS):

   | Type | Name | Value |
   | --- | --- | --- |
   | `A` | `@` | `76.76.21.21` |
   | `CNAME` | `www` | `cname.vercel-dns.com` |

4. Wait for the certificate (usually under a minute), then set the primary
   domain in Vercel and make sure `www` redirects to it.
5. Update `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` to `https://littleluxe.com`
   and redeploy — otherwise canonicals and auth callbacks still point at the
   `.vercel.app` host.

---

## 6. Set up Supabase (database)

1. Create a project at <https://supabase.com/dashboard> — pick **Singapore**
   (`ap-southeast-1`) to match the Vercel region.
2. **Project Settings → Database → Connection string → URI** and copy both:
   - **Connection pooling** (port `6543`) → `DATABASE_URL`
   - **Direct connection** (port `5432`) → `DIRECT_URL`
3. Append `?pgbouncer=true&connection_limit=1` to the pooled URL.
4. Locally, put both in `.env`, then push the schema and seed:

```bash
npx prisma generate
npx prisma db push          # creates all 8 tables + 5 enums
npm run db:seed             # 12 products, admin, 3 customers, 4 coupons, 5 orders
```

5. Add the same two values in Vercel, redeploy, and check:

```bash
curl -s https://your-domain.com/api/health
# { "mode": "production", "database": "connected", ... }
```

The admin login is `admin@littleluxe.com` / `admin123` — **change it immediately**
after your first sign-in (Admin → Settings), and rotate the demo customer
passwords while you are there.

---

## 7. Set up Cloudinary (images + 3D models)

1. Create a free account at <https://cloudinary.com>.
2. **Dashboard → Product Environment Credentials** → copy the cloud name, API
   key and API secret into `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
   `CLOUDINARY_API_SECRET`.
3. Redeploy. Uploads now go to `little-luxe/products` (images, ≤5 MB,
   JPEG/PNG/WebP) and `little-luxe/models` (`.glb`, ≤10 MB), and are delivered
   through `res.cloudinary.com` with `f_auto,q_auto` — the URLs in
   `lib/image-optimizer.ts` already ask for the right crop per size preset.
4. Cloudinary → **Settings → Optimization** → enable *Auto format* and
   *Auto quality* so any legacy asset gets the same treatment.

Without these keys the app stores uploads in `.uploads/` and serves them through
`/uploads/…` — fine for a preview, not for production (ephemeral filesystem).

---

## 8. Run `prisma db push` on every schema change

Locally, after editing `prisma/schema.prisma`:

```bash
npx prisma db push && npm run db:seed
```

For a team, switch to migrations instead:

```bash
npx prisma migrate dev --name add_wishlist_table   # local
npx prisma migrate deploy                          # in CI / Vercel build
```

---

## 9. Seed and go live ✅

Final checklist before announcing:

- [ ] `DATABASE_URL` + `DIRECT_URL` set in Vercel, `/api/health` shows
      `"database":"connected"`
- [ ] `NEXTAUTH_SECRET` set to a fresh 32-byte random string, `NEXTAUTH_URL`
      points at the real domain
- [ ] Admin password changed away from `admin123`
- [ ] Cloudinary keys set; one test upload round-trips through the admin console
- [ ] Wallet numbers in `PAYMENT_*` match the accounts you actually check
- [ ] `littleluxe.com` + `www` resolve with a valid certificate
- [ ] `https://littleluxe.com/sitemap.xml` and `/robots.txt` respond, and the
      sitemap is submitted in Google Search Console
- [ ] Share a product link in WhatsApp — the OG card should show the gold "LL"
      artwork
- [ ] Install the PWA on a phone (Share → *Add to Home Screen*) and confirm the
      gold icon appears

Then post the launch 🎉

---

## Optional extras

### Service worker (offline support)

The PWA ships with a manifest, icons and install metadata — enough to be
installable. Offline caching is intentionally **not** enabled, because a stale
service worker is the fastest way to serve yesterday's prices. When you want it:

```bash
npm i -D @ducanh2912/next-pwa
```

```ts
// next.config.ts
import withPWA from "@ducanh2912/next-pwa";

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  workboxOptions: {
    // network-first for /api, stale-while-revalidate for product pages
  },
})(nextConfig);
```

Then point offline navigations at the page that already exists at `/offline`.

### Self-hosting the standalone build

`next.config.ts` sets `output: "standalone"`, so a VPS or Docker image only has to
ship the traced server bundle:

```bash
npm run build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

`npm run start` also works locally, it just warns that the standalone output is
the production entry point. Remember `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL`
must match the public origin, and keep `public/` next to `server.js` so the
manifest, icons and demo assets resolve.

### Error monitoring

`app/error.tsx` logs to the console. Add Sentry with
`npx @sentry/wizard@latest -i nextjs` and forward `error.digest` alongside it.

### Analytics

Vercel Analytics (`@vercel/analytics`) or Plausible — both are a two-line
change in `app/layout.tsx`. The console's own analytics page is mocked data and
is clearly labelled as such.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `PrismaClientInitializationError` in logs | `DATABASE_URL` missing/incorrect, or the pooled URL is missing `?pgbouncer=true` |
| Sign-in loops back to `/login` | `NEXTAUTH_URL` doesn't match the deployed domain, or `NEXTAUTH_SECRET` changed between deploys |
| Uploads vanish after a while | Cloudinary keys not set — local uploads live on the ephemeral filesystem |
| Canonical URLs point at `localhost` | `NEXT_PUBLIC_SITE_URL` not set in Vercel |
| OG image shows the old generic card | Share caches — re-scrape in the [Facebook debugger](https://developers.facebook.com/tools/debug/) |
| Build fails on `prisma generate` | `@prisma/client` regenerates itself on install — keep `prisma` in `dependencies` (it is) so its CLI resolves, and set `DATABASE_URL` before the build if you use `prisma migrate deploy` |
