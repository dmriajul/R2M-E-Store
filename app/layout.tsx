import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import localFont from "next/font/local";
import { SITE } from "@/lib/site";
import { CookieConsent } from "@/components/CookieConsent";
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
    default: "MUKRA — Premium Kids Fashion Bangladesh",
    template: "%s | MUKRA — Premium Kids Fashion BD",
  },
  description: SITE.description,
  applicationName: "MUKRA",
  keywords: [
    "kids fashion Bangladesh",
    "children's clothing BD",
    "organic kids clothes",
    "toddler outfits Bangladesh",
    "kids shoes BD",
    "baby clothes",
    "mukra",
    "premium kids fashion",
    "kids wear Dhaka",
    "children fashion Bangladesh",
  ],
  authors: [{ name: "MUKRA", url: SITE.url }],
  creator: "MUKRA",
  publisher: "MUKRA",
  category: "shopping",
  // Every route canonicalises to itself; pages may override with an absolute URL.
  alternates: { canonical: "./" },
  // ---------- PWA ----------
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
      { url: "/icons/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/icons/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/favico.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: [
      { url: "/icons/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "MUKRA",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, address: false, email: false },
  // ---------- Social ----------
  openGraph: {
    type: "website",
    siteName: "MUKRA",
    title: "MUKRA — Premium Kids Fashion Bangladesh",
    description: SITE.description,
    url: SITE.url,
    locale: "en_BD",
    alternateLocale: ["bn_BD"],
  },
  twitter: {
    card: "summary_large_image",
    title: "MUKRA — Premium Kids Fashion Bangladesh",
    description: SITE.description,
    site: "@mukra",
    creator: "@mukra",
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
  themeColor: "#0A3622",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

/** Organization JSON-LD Schema */
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MUKRA",
  url: SITE.url,
  logo: `${SITE.url}/logo.png`,
  description: "Premium kids fashion for ages 0-12. Where Magic Meets Style.",
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+8801712345678",
    contactType: "customer service",
    availableLanguage: ["English", "Bengali"],
  },
  sameAs: [
    "https://www.facebook.com/mukra",
    "https://www.instagram.com/mukra",
    "https://www.twitter.com/mukra",
  ],
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
  const gaId = process.env.NEXT_PUBLIC_GA_ID || "";

  return (
    <html
      lang="en"
      translate="no"
      className={`${inter.variable} dark notranslate`}
      suppressHydrationWarning
    >
      <head>
        <meta name="google" content="notranslate" />
        <link rel="preconnect" href="https://challenges.cloudflare.com" />
        <link rel="dns-prefetch" href="https://challenges.cloudflare.com" />
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body
        className="flex min-h-dvh flex-col bg-background text-foreground"
        suppressHydrationWarning={true}
      >
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
        <CookieConsent />
        <AppToaster />
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
