/**
 * Shown while the WebGL chunk is downloading (and on devices without WebGL).
 * Pure CSS so it costs nothing and matches the gold system.
 */
export function SceneLoadingFallback() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div className="relative size-40 sm:size-56">
        <div className="absolute inset-0 animate-pulse rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-6 rounded-full border border-primary/25" />
        <div className="absolute inset-10 rounded-full border-t-2 border-primary/70 motion-safe:animate-spin" />
      </div>
    </div>
  );
}
