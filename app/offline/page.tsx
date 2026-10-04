import type { Metadata } from "next";
import Link from "next/link";
import { Home, WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: { absolute: "You're offline | Little Luxe" },
  robots: { index: false, follow: false },
};

/**
 * Offline fallback.
 *
 * There is no service worker in this build (see DEPLOYMENT.md — adding Workbox
 * is a five-minute follow-up), so this page is a destination the app can point
 * at the moment one is added. It also gives the browser something friendly to
 * show if a navigation fails mid-flight.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center">
      <span
        aria-hidden
        className="grid size-16 place-items-center rounded-full border border-glass-border bg-glass"
      >
        <WifiOff className="size-7 text-muted-foreground" />
      </span>

      <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
        You&rsquo;re offline
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Little Luxe needs a connection to load fresh prices and stock. Reconnect
        and we&rsquo;ll pick up right where you left off — your bag is saved on
        this device.
      </p>

      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_34px_-10px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Home aria-hidden className="size-4" />
        Try Again
      </Link>
    </div>
  );
}
