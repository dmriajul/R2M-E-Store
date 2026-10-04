import { Skeleton } from "@/components/ui/skeleton";

/**
 * Account-area loading state.
 *
 * Nested inside the dashboard shell (sidebar + breadcrumb stay mounted), so
 * this only shapes the content column: page header, a row of stat cards and two
 * panels — the same rhythm the real pages settle into.
 */
export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      {/* ---------- Page header ---------- */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24 rounded-full bg-primary/25" />
        <Skeleton className="h-9 w-64 max-w-full rounded-2xl bg-white/8" />
        <Skeleton className="h-4 w-80 max-w-full rounded-full bg-white/6" />
      </div>

      {/* ---------- Stat cards ---------- */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-2xl border border-glass-border bg-[#101010] p-4"
          >
            <Skeleton className="size-9 rounded-xl bg-primary/20" />
            <Skeleton className="h-6 w-16 rounded-lg bg-white/8" />
            <Skeleton className="h-3 w-24 rounded-full bg-white/6" />
          </div>
        ))}
      </div>

      {/* ---------- Panels ---------- */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-3 rounded-2xl border border-glass-border bg-[#101010] p-4">
          <Skeleton className="h-4 w-40 rounded-full bg-white/8" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 pt-1">
              <Skeleton className="size-12 shrink-0 rounded-xl bg-white/6" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-2/3 rounded-full bg-white/8" />
                <Skeleton className="h-3 w-1/3 rounded-full bg-white/6" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-glass-border bg-[#101010] p-4">
          <Skeleton className="h-4 w-32 rounded-full bg-white/8" />
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl bg-white/6" />
          ))}
        </div>
      </div>

      <span className="sr-only">Loading your account…</span>
    </div>
  );
}
