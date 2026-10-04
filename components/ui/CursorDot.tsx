"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Desktop-only gold cursor companion.
 *
 * A pointer-following dot with a soft halo that swells over anything clickable.
 * Performance rules it obeys:
 *
 * - **Never on touch** — only mounts when `(pointer: fine)` matches, so phones
 *   and tablets pay nothing (not even a listener).
 * - **No React re-renders** — the pointer position and the scale live in refs
 *   and are written straight to the element's `transform` inside one
 *   `requestAnimationFrame` loop that parks itself when the tab is hidden or
 *   the pointer leaves the window.
 * - **Respects the user** — disabled entirely under `prefers-reduced-motion`.
 * - **Cheap hit-testing** — a single delegated `pointerover` listener runs
 *   `closest()` against one selector, instead of wiring up hundreds of cards.
 *
 * Purely decorative: `aria-hidden`, `pointer-events-none`, so it is invisible
 * to screen readers and never swallows a click.
 */
const INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "[role='button']",
  "input",
  "select",
  "textarea",
  "summary",
  "[data-cursor='hover']",
].join(",");

/** Spring-ish easing constants — high damping keeps it from feeling laggy. */
const POSITION_EASE = 0.55;
const SCALE_EASE = 0.18;

export function CursorDot() {
  const [enabled, setEnabled] = useState(false);
  const dotRef = useRef<HTMLDivElement>(null);

  const target = useRef({ x: 0, y: 0, scale: 1 });
  const current = useRef({ x: 0, y: 0, scale: 1 });
  const visible = useRef(false);
  const frame = useRef<number | null>(null);

  /* ---------- Capability check (client-only, after paint) ---------- */
  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sync = () => setEnabled(finePointer.matches && !reducedMotion.matches);
    sync();

    finePointer.addEventListener("change", sync);
    reducedMotion.addEventListener("change", sync);
    return () => {
      finePointer.removeEventListener("change", sync);
      reducedMotion.removeEventListener("change", sync);
    };
  }, []);

  /* ---------- The loop ---------- */
  useEffect(() => {
    const node = dotRef.current;
    if (!enabled || !node) return;

    node.style.opacity = "0";

    const draw = () => {
      const el = dotRef.current;
      if (!el) {
        frame.current = null;
        return;
      }

      const t = target.current;
      const c = current.current;

      c.x += (t.x - c.x) * POSITION_EASE;
      c.y += (t.y - c.y) * POSITION_EASE;
      c.scale += (t.scale - c.scale) * SCALE_EASE;

      el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${c.scale.toFixed(3)})`;

      // Keep animating only while the dot still has ground to cover.
      const settled =
        Math.abs(t.x - c.x) < 0.1 &&
        Math.abs(t.y - c.y) < 0.1 &&
        Math.abs(t.scale - c.scale) < 0.002;

      if (settled) {
        frame.current = null;
        return;
      }
      frame.current = requestAnimationFrame(draw);
    };

    const kick = () => {
      if (frame.current === null) frame.current = requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      target.current.x = event.clientX;
      target.current.y = event.clientY;

      if (!visible.current) {
        visible.current = true;
        current.current.x = event.clientX;
        current.current.y = event.clientY;
        node.style.opacity = "1";
      }
      kick();
    };

    const onPointerOver = (event: PointerEvent) => {
      const el = event.target;
      const hovering =
        el instanceof Element && el.closest(INTERACTIVE_SELECTOR) !== null;
      const next = hovering ? 2.4 : 1;
      if (target.current.scale !== next) {
        target.current.scale = next;
        kick();
      }
    };

    const hide = () => {
      visible.current = false;
      if (dotRef.current) dotRef.current.style.opacity = "0";
    };

    const onVisibility = () => {
      if (document.hidden) hide();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerover", onPointerOver, { passive: true });
    window.addEventListener("pointerdown", kick, { passive: true });
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("pointerleave", hide);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerover", onPointerOver);
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerleave", hide);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={dotRef}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[90] hidden size-3 rounded-full bg-primary opacity-0 will-change-transform md:block"
      style={{ transition: "opacity 200ms ease-out" }}
    >
      <span className="absolute inset-0 -z-10 scale-[2.6] rounded-full bg-primary/18 blur-[2px]" />
    </div>
  );
}
