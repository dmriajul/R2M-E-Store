import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Uploads are user content: never let a browser sniff or inline them.
        source: "/uploads/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

export default nextConfig;
