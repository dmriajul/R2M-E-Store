import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SITE } from "@/lib/site";
import { AppToaster } from "@/components/providers/AppToaster";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { CartHydration } from "@/components/providers/CartHydration";
import { SkipToContent } from "@/components/ui/SkipToContent";
import { CursorDot } from "@/components/ui/CursorDot";
import "./globals.css";

/**
 * Inter (variable, latin subset) is self-hosted so builds never depend on
 * Google Fonts being reachable. Update with:
 *   cp node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2 \
 *      app/fonts/inter-latin-variable.woff2
 *
 * `display: "swap"` prevents FOIT (text paints immediately in the fallback and
 * swaps when Inter lands) and `preload: true` inlines the woff2 as a
 * `<link rel="preload">` so there is no late font flash at all. Only the latin
 * subset ships — all Bengali copy renders with the system/Noto stack.
 */
const inter = localFont({
  src: "./fonts/inter-latin-variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: true,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Little Luxe — Premium Kids Fashion",
    template: "%s | Little Luxe — Premium Kids Fashion",
  },
  description: SITE.description,
  applicationName: "Little Luxe",
  keywords: [
    "kids fashion",
    "children's clothing Bangladesh",
    "organic kids clothes",
    "toddler outfits",
    "kids shoes",
    "baby clothes",
    "little luxe",
  ],
  authors: [{ name: "Little Luxe", url: SITE.url }],
  creator: "Little Luxe",
  publisher: "Little Luxe",
  category: "shopping",
  // Every route canonicalises to itself; pages may override with an absolute URL.
  alternates: { canonical: "./" },
  // ---------- PWA ----------
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icons/icon-192.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Little Luxe",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, address: false, email: false },
  // ---------- Social ----------
  openGraph: {
    type: "website",
    siteName: "Little Luxe",
    title: "Little Luxe — Premium Kids Fashion",
    description: SITE.description,
    url: SITE.url,
    locale: "en_BD",
    alternateLocale: ["bn_BD"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Little Luxe — Premium Kids Fashion",
    description: SITE.description,
    site: "@littleluxe",
    creator: "@littleluxe",
  },
  // ---------- Crawling ----------
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#D4AF37",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

/**
 * Root layout: fonts, metadata, structured chrome.
 *
 * Page chrome (Navbar/Footer) deliberately lives in the route-group layouts
 * instead of here, so the auth pages can render as a focused, chrome-free
 * experience — see app/(shop)/layout.tsx and app/(auth)/layout.tsx.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        {/* First Tab stop on every page. */}
        <SkipToContent />
        {/* Desktop-only pointer flourish — inert on touch devices. */}
        <CursorDot />

        {/* Auth.js session context — client-side, so pages stay static. */}
        <AuthProvider>
          {children}
          {/* Restores the persisted bag after hydration (skipHydration). */}
          <CartHydration />
        </AuthProvider>
        <AppToaster />
      </body>
    </html>
  );
}
