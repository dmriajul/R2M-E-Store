"use client";

import { useEffect } from "react";
import Link from "next/link";
import { MessageCircle, RefreshCw, ShoppingBag } from "lucide-react";

/**
 * Storefront error boundary (home, shop, product, checkout and the account
 * area). Renders inside the shop layout, so the Navbar and Footer stay put and
 * the visitor never feels dropped out of the store.
 */
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[little-luxe] storefront error:", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="glass-soft relative overflow-hidden rounded-3xl p-8 text-center sm:p-12">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(212,175,55,0.14)_0%,transparent_70%)]"
        />

        <span aria-hidden className="relative text-5xl">
          🧸
        </span>

        <h1 className="relative mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
          Something went wrong
        </h1>
        <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          This page tripped over its shoelaces. Your bag is safe — give it another
          try, or carry on browsing the collection.
        </p>
        {error.digest && (
          <p className="relative mt-3 font-mono text-[11px] tracking-wide text-muted-foreground/80">
            Error ID: {error.digest}
          </p>
        )}

        <div className="relative mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_34px_-10px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:hover:scale-[1.02]"
          >
            <RefreshCw aria-hidden className="size-4" />
            Try Again
          </button>

          <Link
            href="/shop"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-glass-border bg-glass px-6 text-sm font-semibold text-foreground transition-all duration-400 ease-[var(--ease-luxe)] hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ShoppingBag aria-hidden className="size-4" />
            Keep Shopping
          </Link>

          <a
            href="mailto:hello@littleluxe.com"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-glass-border bg-glass px-6 text-sm font-semibold text-muted-foreground transition-all duration-400 ease-[var(--ease-luxe)] hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <MessageCircle aria-hidden className="size-4" />
            Tell Us
          </a>
        </div>
      </div>
    </div>
  );
}
