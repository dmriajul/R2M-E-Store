/**
 * Global route-level loading state — the gold pulsing wordmark.
 *
 * Deliberately tiny: it renders while a server component streams, so it must
 * not import anything heavy (no framer-motion, no icons).
 */
export default function GlobalLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4"
    >
      <span className="text-gradient-gold animate-pulse text-2xl font-bold tracking-[0.32em] uppercase sm:text-3xl">
        Little Luxe
      </span>
      <span
        aria-hidden
        className="shimmer-gold h-px w-40 rounded-full sm:w-56"
      />
      <span className="sr-only">Loading Little Luxe…</span>
    </div>
  );
}
