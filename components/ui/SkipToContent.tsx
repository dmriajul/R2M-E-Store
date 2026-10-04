/**
 * Keyboard-only escape hatch past the navbar.
 *
 * Visually hidden until it receives focus (Tab on load), then it parks itself
 * in the top-left corner as a gold pill and jumps to `#main-content`. Kept as a
 * server component — it needs no state.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)] focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:outline-2 focus:outline-offset-2 focus:outline-ring"
    >
      Skip to content
    </a>
  );
}
