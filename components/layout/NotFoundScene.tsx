"use client";

import dynamic from "next/dynamic";
import { SceneLoadingFallback } from "@/components/three/SceneLoadingFallback";

/**
 * The hero WebGL backdrop, reused at a smaller size on the 404 page.
 *
 * Same lazy, client-only loading pattern as the hero: three/fiber stays out of
 * the initial bundle and the CSS fallback paints instantly if WebGL (or the
 * network) is unavailable.
 */
const HeroScene = dynamic(() => import("@/components/three/HeroScene"), {
  ssr: false,
  loading: () => <SceneLoadingFallback />,
});

export function NotFoundScene() {
  return (
    <div
      aria-hidden
      className="pointer-events-none relative mx-auto h-48 w-full max-w-md overflow-hidden sm:h-56"
    >
      <HeroScene className="absolute inset-0" />
    </div>
  );
}
