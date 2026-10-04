import type { NextConfig } from "next";

/** One year, used for fingerprinted build output. */
const IMMUTABLE = "public, max-age=31536000, immutable";

/** HTML pages: a short CDN TTL with background revalidation. */
const HTML_CACHE = "public, s-maxage=60, stale-while-revalidate=300";

/** Public files that change rarely (photos, 3D models, demo receipts). */
const STATIC_FILE = "public, max-age=86400, stale-while-revalidate=604800";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  /** Docker/self-host friendly server bundle (Vercel ignores it). */
  output: "standalone",
  /**
   * Prisma ships native engine binaries that must stay outside the bundler, and
   * it is only imported lazily (`lib/prisma.ts`) when DATABASE_URL is set.
   */
  serverExternalPackages: ["@prisma/client"],
  // Allow the sandboxed preview proxy (and localhost) to hit the dev server
  // for HMR assets without being treated as cross-origin.
  allowedDevOrigins: ["*.e2b.app", "*.e2b.dev", "localhost", "127.0.0.1"],
  images: {
    // Product photography + payment screenshots arrive from Cloudinary once the
    // env keys are set; local uploads are served from /public/uploads.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Kept so any leftovers from earlier steps keep rendering.
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
  },
  /**
   * Barrel-file tree shaking. `three`/`@react-three/fiber` stay in lazy chunks
   * (both 3D viewers are `next/dynamic({ ssr: false })`), but when they do load
   * these imports keep the chunk as small as possible.
   */
  experimental: {
    optimizePackageImports: ["@react-three/fiber", "@react-three/drei", "lucide-react", "framer-motion"],
  },
  async headers() {
    return [
      /* ---------- Security (every route) ---------- */
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // SAMEORIGIN rather than DENY so the sandbox preview (and any future
          // branded iframe) can still embed the store; production Vercel
          // headers live in vercel.json.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },

      /* ---------- Immutable build output ---------- */
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: IMMUTABLE }],
      },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: IMMUTABLE }],
      },
      {
        source: "/demo/:path*",
        headers: [{ key: "Cache-Control", value: STATIC_FILE }],
      },
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: STATIC_FILE }],
      },
      {
        source: "/models/:path*",
        headers: [{ key: "Cache-Control", value: STATIC_FILE }],
      },
      {
        // User uploads served through the app route (local-disk demo mode).
        source: "/uploads/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },

      /* ---------- Cacheable HTML ---------- */
      ...["/", "/shop", "/faq", "/shipping", "/returns", "/terms", "/privacy"].map(
        (source) => ({ source, headers: [{ key: "Cache-Control", value: HTML_CACHE }] }),
      ),
      ...["/product/:path*", "/login", "/register", "/forgot-password"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: HTML_CACHE }],
      })),

      /* ---------- Robots + sitemap ---------- */
      {
        source: "/robots.txt",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
      {
        source: "/sitemap.xml",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },

      /* ---------- API ---------- */
      {
        // Never cache authentication or session-scoped responses.
        source: "/api/auth/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/api/orders",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/api/health",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        // Catalogue data is safe to reuse briefly; it changes rarely.
        source: "/api/products",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=600" },
        ],
      },

      /* ---------- Keep private surfaces out of the index ---------- */
      ...[
        "/admin",
        "/admin/:path*",
        "/dashboard",
        "/dashboard/:path*",
        "/checkout",
        "/offline",
      ].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};

export default nextConfig;
