"use client";

import {
  Component,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import type { Group } from "three";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { EnvironmentWithFallback } from "@/components/three/EnvironmentWithFallback";
import { ProductViewerFallback } from "@/components/three/ProductViewerFallback";
import { CATEGORY_META } from "@/lib/site";
import type { ProductCategory } from "@/types";

/* -------------------------------------------------------------------------- */
/*  Geometry                                                                  */
/* -------------------------------------------------------------------------- */

interface ViewerModelProps {
  category: ProductCategory;
  color: string;
}

/**
 * Category silhouette standing in for the product. Real .glb models drop in
 * here later (see public/models) without touching the rest of the viewer.
 */
function ViewerModel({ category, color }: ViewerModelProps) {
  const groupRef = useRef<Group>(null);
  const material = (
    <meshPhysicalMaterial
      color={color}
      metalness={0.3}
      roughness={0.4}
      clearcoat={0.5}
      sheen={1}
      sheenColor="#ffffff"
      envMapIntensity={1.1}
    />
  );

  // Gentle bob keeps the still model feeling alive between drags.
  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    group.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.07;
    group.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.03;
  });

  const geometry = (() => {
    switch (category) {
      case "Dresses":
        /* Open cone = A-line dress silhouette. */
        return (
          <mesh position={[0, -0.15, 0]}>
            <coneGeometry args={[1.05, 1.9, 44, 1, true]} />
            {material}
          </mesh>
        );
      case "Shoes":
        return (
          <mesh rotation={[0, 0.45, 0]}>
            <boxGeometry args={[2.1, 0.85, 1]} />
            {material}
          </mesh>
        );
      case "Outerwear":
        return (
          <mesh>
            <cylinderGeometry args={[0.78, 0.98, 1.85, 40]} />
            {material}
          </mesh>
        );
      case "Accessories":
        return (
          <mesh rotation={[Math.PI / 2.6, 0, 0]}>
            <torusGeometry args={[0.85, 0.3, 32, 72]} />
            {material}
          </mesh>
        );
      case "Tops & Tees":
        /* Folded tee: a soft-cornered slab. */
        return (
          <RoundedBox args={[1.85, 1.45, 0.62]} radius={0.24} smoothness={5}>
            {material}
          </RoundedBox>
        );
      case "Bottoms":
        return (
          <mesh>
            <capsuleGeometry args={[0.58, 1.15, 10, 28]} />
            {material}
          </mesh>
        );
      default:
        return (
          <mesh>
            <icosahedronGeometry args={[1.1, 1]} />
            {material}
          </mesh>
        );
    }
  })();

  return <group ref={groupRef}>{geometry}</group>;
}

/* -------------------------------------------------------------------------- */
/*  Lighting                                                                  */
/* -------------------------------------------------------------------------- */

function ViewerLighting({ accent }: { accent: string }) {
  return (
    <>
      {/* Bright and cheerful, not moody. */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 4]} intensity={1.7} color="#FFF5E6" />
      <directionalLight position={[-4, 1, -3]} intensity={0.7} color={accent} />
      <pointLight position={[0, -2.5, 3]} intensity={8} distance={9} color="#ffffff" />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Loop driver                                                              */
/* -------------------------------------------------------------------------- */

/**
 * `frameloop="demand"` only paints when asked. AutoRotate (and the idle bob)
 * need a continuous loop, so this driver asks for exactly one more frame after
 * every rendered frame — and stops the moment the canvas leaves the viewport.
 */
function DemandDriver() {
  const invalidate = useThree((state) => state.invalidate);

  useFrame(() => {
    invalidate();
  });

  return null;
}

/* -------------------------------------------------------------------------- */
/*  Fallbacks & boundaries                                                    */
/* -------------------------------------------------------------------------- */

interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

/** Keeps the viewer on-brand if WebGL or the effects chain fails. */
class ViewerErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    console.warn("[ProductViewer] WebGL scene failed — showing the placeholder.");
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* -------------------------------------------------------------------------- */
/*  Viewer                                                                    */
/* -------------------------------------------------------------------------- */

interface ProductViewerProps {
  category: ProductCategory;
  /** Hex colour taken from the product (its `modelColor`). */
  color: string;
  productName?: string;
  className?: string;
}

/**
 * Contained 3D product preview: category-shaped placeholder, fabric-like
 * physical material, orbit + zoom, gentle auto-rotation.
 *
 * Drag/zoom are only armed on devices with a precise pointer, so touch users
 * can still scroll the page over the canvas (the canvas itself keeps
 * `touch-pan-y`). Auto-rotation runs everywhere and pauses off-screen.
 */
export function ProductViewer({
  category,
  color,
  productName,
  className,
}: ProductViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOnScreen, setIsOnScreen] = useState(true);
  const hasPrecisePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const accent = CATEGORY_META[category].glow;

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsOnScreen(entry?.isIntersecting ?? true),
      { rootMargin: "120px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`relative aspect-square w-full touch-pan-y overflow-hidden rounded-3xl border border-glass-border bg-[#0c0c0c] ${className ?? ""}`}
    >
      {/* Warm studio backdrop so the model reads against the dark page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_15%,rgba(255,245,230,0.10)_0%,transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-10 bottom-6 h-16 rounded-full blur-2xl"
        style={{ backgroundColor: accent, opacity: 0.22 }}
      />

      <ViewerErrorBoundary
        fallback={
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="text-6xl" aria-hidden>
              {CATEGORY_META[category].emoji}
            </span>
            <p className="text-xs text-muted-foreground">
              3D preview unavailable on this device
            </p>
          </div>
        }
      >
        <Canvas
          dpr={[1, 1.5]}
          frameloop={isOnScreen ? "demand" : "never"}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 0.2, 4.1], fov: 42 }}
          fallback={<ProductViewerFallback />}
          aria-label={`3D preview of ${productName ?? category}`}
          role="img"
        >
          <Suspense fallback={null}>
            <ViewerLighting accent={accent} />
            <ViewerModel category={category} color={color} />

            <EnvironmentWithFallback preset="apartment" accent={accent} secondary={accent} />

            <OrbitControls
              makeDefault
              enableZoom={hasPrecisePointer}
              enablePan={false}
              enableRotate={hasPrecisePointer}
              autoRotate
              autoRotateSpeed={2}
              minDistance={2.5}
              maxDistance={5}
              minPolarAngle={Math.PI / 3.2}
              maxPolarAngle={Math.PI / 1.7}
            />

            <DemandDriver />
          </Suspense>
        </Canvas>
      </ViewerErrorBoundary>

      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-center text-[10px] tracking-[0.2em] text-muted-foreground/70 uppercase">
        {hasPrecisePointer
          ? "Drag to rotate · scroll to zoom"
          : "Auto-rotating preview"}
      </p>
    </div>
  );
}

export default ProductViewer;
