import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Home, ShoppingBag } from "lucide-react";
import { NotFoundScene } from "@/components/layout/NotFoundScene";

export const metadata: Metadata = {
  title: { absolute: "Page Not Found | Little Luxe" },
  robots: { index: false, follow: true },
};

/** Suggested destinations — real routes, so the visitor has somewhere to go. */
const SUGGESTIONS = [
  { label: "New Arrivals", href: "/shop?sort=newest" },
  { label: "Dresses", href: "/shop?category=dresses" },
  { label: "Shoes", href: "/shop?category=shoes" },
  { label: "Track an order", href: "/dashboard/orders" },
] as const;

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(212,175,55,0.10)_0%,transparent_70%)]"
      />

      <NotFoundScene />

      <p className="relative mt-2 text-xs font-semibold tracking-[0.32em] text-primary uppercase">
        404 · Lost in the playroom
      </p>
      <h1 className="relative mt-4 flex items-center gap-3 text-3xl font-bold tracking-tight text-gradient-gold sm:text-4xl">
        Page Not Found <span aria-hidden>🧸</span>
      </h1>
      <p className="relative mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
        That link has wandered off. The good stuff is only a tap away — try the
        collection, or head back to the front of the shop.
      </p>

      <div className="relative mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_34px_-10px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:hover:scale-[1.02]"
        >
          <Home aria-hidden className="size-4" />
          Go Home
        </Link>

        <Link
          href="/shop"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-glass-border bg-glass px-6 text-sm font-semibold text-foreground transition-all duration-400 ease-[var(--ease-luxe)] hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ShoppingBag aria-hidden className="size-4" />
          Shop the Collection
        </Link>
      </div>

      <ul className="relative mt-10 flex flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-glass-border bg-glass px-4 text-xs font-medium text-muted-foreground transition-colors duration-300 hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ArrowLeft aria-hidden className="size-3 rotate-180" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
