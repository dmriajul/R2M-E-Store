"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RefreshCw } from "lucide-react";

/**
 * Root error boundary.
 *
 * Catches anything a route throws, logs it once for the console/devtools, and
 * offers the two things a stuck visitor actually wants: try again, or go home.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in the browser console; wire to Sentry/Logflare in production.
    console.error("[little-luxe] route error:", error);
  }, [error]);

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(244,63,94,0.10)_0%,transparent_65%)]"
      />

      <div className="glass relative w-full max-w-lg rounded-3xl p-8 text-center sm:p-10">
        <span aria-hidden className="text-5xl">
          😢
        </span>

        <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          That one is on us — the page could not finish loading. Try again, and if
          it keeps happening the error id below helps us find it fast.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-[11px] tracking-wide text-muted-foreground/80">
            Error ID: {error.digest}
          </p>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_34px_-10px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:hover:scale-[1.02]"
          >
            <RefreshCw aria-hidden className="size-4" />
            Try Again
          </button>

          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-glass-border bg-glass px-6 text-sm font-semibold text-foreground transition-all duration-400 ease-[var(--ease-luxe)] hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Home aria-hidden className="size-4" />
            Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}
