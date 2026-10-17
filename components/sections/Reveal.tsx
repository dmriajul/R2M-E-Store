"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds to wait before the reveal starts. */
  delay?: number;
  /** Travel distance in px. Ignored when reduced motion is requested. */
  distance?: number;
  /** When false the element animates every time it enters the viewport. */
  once?: boolean;
}

/**
 * Scroll-reveal wrapper used by the home page to stage each section.
 * Animates opacity + Y once the element is ~20% visible.
 *
 * **Fail-visible by design.** The server HTML renders the children at full
 * opacity — the hidden start state is armed only by this client effect, and
 * only for elements still below the fold. So:
 *
 *  - no JavaScript / failed hydration → content simply stays visible;
 *  - content already on screen at hydration → no hide-then-show flicker;
 *  - `prefers-reduced-motion` → the CSS keeps the final state throughout and
 *    the observer never hides anything.
 *
 * The motion itself is CSS (`.reveal-hidden` / `.reveal-shown` in
 * globals.css) keyed off the `state` below.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  distance = 40,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  /** "rest" = visible, never touched. "hidden" = armed below the fold. */
  const [state, setState] = useState<"rest" | "hidden" | "shown">("rest");

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Anything already on screen keeps its rendered (visible) state.
    const rect = element.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight * 0.9 && rect.bottom > 0;
    if (alreadyVisible) return;

    setState("hidden");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setState("shown");
            if (once) observer.disconnect();
          } else if (!once) {
            setState("hidden");
          }
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [once]);

  return (
    <div
      ref={ref}
      className={cn(
        state === "hidden" && "reveal-hidden",
        state === "shown" && "reveal-shown",
        className,
      )}
      style={
        {
          "--reveal-y": `${distance}px`,
          "--reveal-delay": `${delay}s`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
