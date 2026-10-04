import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SITE } from "@/lib/site";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

/**
 * Inter (variable, latin subset) is self-hosted so builds never depend on
 * Google Fonts being reachable. Update with:
 *   cp node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2 \
 *      app/fonts/inter-latin-variable.woff2
 */
const inter = localFont({
  src: "./fonts/inter-latin-variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  style: "normal",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Modern Luxury, Considered`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "luxury",
    "e-commerce",
    "timepieces",
    "fragrance",
    "leather goods",
  ],
  openGraph: {
    title: `${SITE.name} — Modern Luxury, Considered`,
    description: SITE.description,
    type: "website",
    url: SITE.url,
    siteName: SITE.name,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — Modern Luxury, Considered`,
    description: SITE.description,
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        <Navbar />
        <main className="relative z-10 flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
