"use client";

import { Component, Suspense, type ReactNode } from "react";
import { Environment, Lightformer } from "@react-three/drei";

interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

/** Catches a failed HDRI fetch and renders the local rig instead. */
class EnvironmentErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    console.warn(
      "[EnvironmentWithFallback] HDRI unavailable — using the local light rig.",
    );
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface SoftEnvironmentProps {
  /** Cheerful key tint so kids products stay bright rather than moody. */
  accent?: string;
  secondary?: string;
  resolution?: number;
}

/**
 * Asset-free lighting rig: bright, warm and a little playful. Stands in while
 * the HDRI streams, and permanently if it never arrives.
 */
export function SoftEnvironment({
  accent = "#FFF5E6",
  secondary = "#F472B6",
  resolution = 256,
}: SoftEnvironmentProps) {
  return (
    <Environment resolution={resolution} frames={1}>
      <Lightformer
        form="rect"
        intensity={3}
        color={accent}
        position={[0, 3, 4]}
        rotation={[0, 0, 0]}
        scale={[7, 7, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.8}
        color={secondary}
        position={[-4, 1, 2]}
        rotation={[0, Math.PI / 3, 0]}
        scale={[5, 5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.6}
        color="#A78BFA"
        position={[4, 0, 2]}
        rotation={[0, -Math.PI / 3, 0]}
        scale={[5, 5, 1]}
      />
      <Lightformer
        form="circle"
        intensity={1.2}
        color="#ffffff"
        position={[0, -3, 1]}
        scale={3}
      />
    </Environment>
  );
}

interface EnvironmentWithFallbackProps extends SoftEnvironmentProps {
  /** drei preset name, e.g. "apartment" | "city". */
  preset: "apartment" | "city" | "studio" | "warehouse" | "sunset" | "dawn" | "night" | "forest" | "lobby" | "park";
}

/**
 * `<Environment preset="…" />` streams a ~1 MB HDRI from a third-party CDN at
 * runtime. If that request fails (offline, blocked CDN, strict CSP) we fall
 * back to the procedural rig above, so a viewer can never render unlit.
 */
export function EnvironmentWithFallback({
  preset,
  ...softProps
}: EnvironmentWithFallbackProps) {
  const fallback = <SoftEnvironment {...softProps} />;

  return (
    <EnvironmentErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Environment preset={preset} resolution={softProps.resolution ?? 256} />
      </Suspense>
    </EnvironmentErrorBoundary>
  );
}
