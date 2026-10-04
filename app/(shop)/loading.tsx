import { Skeleton } from "@/components/ui/skeleton";

/**
 * Storefront loading state — a hero bar plus a product grid, shaped like the
 * real layout so the page does not jump when the content arrives.
 */
export default function ShopLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16"
    >
      {/* ---------- Heading ---------- */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-28 rounded-full bg-primary/25" />
        <Skeleton className="h-10 w-3/4 max-w-md rounded-2xl bg-white/8 sm:h-12" />
        <Skeleton className="h-4 w-full max-w-xl rounded-full bg-white/6" />
      </div>

      {/* ---------- Filter bar ---------- */}
      <div className="mt-10 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-10 w-24 rounded-full bg-white/6 sm:w-28"
          />
        ))}
      </div>

      {/* ---------- Product grid ---------- */}
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-3xl border border-glass-border bg-[#101010] p-3"
          >
            <Skeleton className="aspect-4/5 w-full rounded-2xl bg-white/6" />
            <Skeleton className="h-4 w-4/5 rounded-full bg-white/8" />
            <Skeleton className="h-3 w-2/5 rounded-full bg-white/6" />
            <Skeleton className="mt-1 h-9 w-full rounded-full bg-primary/20" />
          </div>
        ))}
      </div>

      <span className="sr-only">Loading the collection…</span>
    </div>
  );
}
