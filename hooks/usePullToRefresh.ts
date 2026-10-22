"use client";

import { useEffect, useState, type RefObject } from "react";

/** Single-finger downward gesture at the document top; never steals horizontal scrolling. */
export function usePullToRefresh(ref: RefObject<HTMLElement | null>, onRefresh: () => Promise<unknown>, disabled: boolean) {
  const [distance, setDistance] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) return;
    let start: { x: number; y: number } | null = null;
    let pull = 0;
    const reset = () => { start = null; pull = 0; setDistance(0); };
    const onStart = (event: TouchEvent) => {
      if (window.innerWidth >= 640 || window.scrollY > 0 || event.touches.length !== 1 || (event.target as Element).closest("button,input,textarea,select,a,[role=dialog]")) return;
      const touch = event.touches[0];
      if (touch) start = { x: touch.clientX, y: touch.clientY };
    };
    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!start || !touch) return;
      const dy = touch.clientY - start.y;
      if (event.touches.length !== 1 || Math.abs(touch.clientX - start.x) > 35 || dy < 0) { reset(); return; }
      if (dy > 12 && event.cancelable) event.preventDefault();
      pull = Math.min(110, dy * 0.6);
      setDistance(pull);
    };
    const onEnd = () => { const trigger = pull >= 70; reset(); if (trigger) void onRefresh(); };
    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchmove", onMove, { passive: false });
    element.addEventListener("touchend", onEnd);
    element.addEventListener("touchcancel", reset);
    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchmove", onMove);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("touchcancel", reset);
    };
  }, [ref, onRefresh, disabled]);
  return distance;
}
