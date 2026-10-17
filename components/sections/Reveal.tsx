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
 * Animates opacity + Y once the element edges into view.
 *
 * **Fail-visible by design.** The server HTML renders the children at full
 * opacity — the hidden start state is armed only by this client effect, and
 * only for elements still *below* the fold. So:
 *
 *  - no JavaScript / failed hydration → content simply stays visible;
 *  - content already on screen at hydration → no hide-then-show flicker;
 *  - content already scrolled *past* → never armed (an observer would not
 *    report it, and the band above the fold would stay blank);
 *  - once revealed, an element stays revealed — scrolling back up never fades
 *    sections out again;
 *  - `prefers-reduced-motion` → nothing is hidden in the first place.
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

    const rect = element.getBoundingClientRect();

    // Anything already on screen keeps its rendered (visible) state.
    const alreadyVisible = rect.top < window.innerHeight * 0.9 && rect.bottom > 0;
    if (alreadyVisible) return;

    // Anything already *above* the viewport must never be armed either: the
    // observer would not fire for it, leaving a permanently blank band on a
    // deep link, a refresh mid-page or a fast anchor jump.
    if (rect.bottom <= 0) return;

    setState("hidden");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // `bottom <= 0` also covers the "scrolled past before the observer
          // landed" race.
          if (entry.isIntersecting || entry.boundingClientRect.bottom <= 0) {
            setState("shown");
            if (once) observer.disconnect();
          } else if (!once) {
            setState("hidden");
          }
        }
      },
      // Any sliver counts — no element is tall enough to fail a percentage
      // threshold, and the fade starts as soon as it edges in.
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
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
