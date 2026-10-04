/**
 * Cute loading state for the 3D product viewer: a pulsing gold star over a
 * spinner ring. Kept in its own module (and free of any three.js imports) so the
 * product page can render it without pulling WebGL into the initial bundle.
 */
export function ProductViewerFallback({ label = "Loading 3D model" }: { label?: string }) {
  return (
    <div className="flex h-full min-h-64 w-full flex-col items-center justify-center gap-3">
      <span
        aria-hidden
        className="text-4xl drop-shadow-[0_0_18px_rgba(212,175,55,0.75)] motion-safe:animate-pulse"
      >
        ⭐
      </span>
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        className="size-10 rounded-full border-2 border-primary/25 border-t-primary motion-safe:animate-spin"
      />
    </div>
  );
}
