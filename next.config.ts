import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow the sandboxed preview proxy (and localhost) to hit the dev server
  // for HMR assets without being treated as cross-origin.
  allowedDevOrigins: ["*.e2b.app", "*.e2b.dev", "localhost", "127.0.0.1"],
  images: {
    // Remote product imagery will be served from the CDN once the backend exists.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.example.com" },
    ],
  },
};

export default nextConfig;
