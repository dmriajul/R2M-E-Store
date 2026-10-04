"use client";

import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query. SSR-safe: the first client render returns
 * `defaultValue`, then the real value is applied in an effect.
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener("change", onChange);

    return () => mediaQuery.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True below the `md` breakpoint (768px by default). Used to downgrade the 3D scene. */
export function useIsMobile(breakpointPx = 768): boolean {
  return useMediaQuery(`(max-width: ${breakpointPx - 1}px)`);
}

/** True when the visitor asked for reduced motion — every animation checks this. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
