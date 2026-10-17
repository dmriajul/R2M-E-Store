import { RefreshCw } from "lucide-react";

/**
 * Rendered by catalogue pages when the products database cannot be reached
 * (`DatabaseUnavailableError`). The store never falls back to sample products —
 * it says so, plainly, and offers a retry.
 */
export function CatalogueUnavailable() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="glass-soft relative overflow-hidden rounded-3xl p-8 text-center sm:p-12">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(212,175,55,0.14)_0%,transparent_70%)]"
        />

        <span aria-hidden className="relative text-5xl">
          🛠️
        </span>

        <h1 className="relative mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
          We&apos;ll be right back
        </h1>
        <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          The shop is having a moment with its inventory system. Nothing was
          lost — please refresh in a little while and the collection will be
          right here.
        </p>

        <div className="relative mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href="/shop"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_34px_-10px_rgba(212,175,55,0.95)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <RefreshCw aria-hidden className="size-4" />
            Try Again
          </a>
        </div>
      </div>
    </div>
  );
}
