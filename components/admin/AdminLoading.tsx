/**
 * Console skeleton shown while a route segment streams in. Purely decorative —
 * the mock data resolves instantly, but the shell stays honest about loading.
 */
export function AdminLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy role="status" aria-live="polite">
      <span className="sr-only">Loading admin data…</span>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-[#242424] bg-[#141414]"
          />
        ))}
      </div>

      <div className="h-72 animate-pulse rounded-xl border border-[#242424] bg-[#141414]" />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="h-80 animate-pulse rounded-xl border border-[#242424] bg-[#141414]" />
        <div className="flex flex-col gap-5">
          <div className="h-44 animate-pulse rounded-xl border border-[#242424] bg-[#141414]" />
          <div className="h-44 animate-pulse rounded-xl border border-[#242424] bg-[#141414]" />
        </div>
      </div>
    </div>
  );
}
