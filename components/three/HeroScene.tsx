"use client";

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { MathUtils, Object3D } from "three";
import type { Group, InstancedMesh, Mesh } from "three";
import { useIsMobile, usePrefersReducedMotion } from "@/hooks/useMediaQuery";

/* -------------------------------------------------------------------------- */
/*  Configuration                                                             */
/* -------------------------------------------------------------------------- */

const GOLD = "#D4AF37";
const CYAN = "#00F0FF";

/**
 * `<Environment preset="city" />` streams a 1 MB HDRI from a third-party CDN at
 * runtime. If that request fails (offline, blocked CDN, strict CSP) the error
 * boundary below swaps in a fully procedural light rig, so the hero can never
 * end up unlit. Set to false to always use the local rig.
 */
const USE_HDRI_ENVIRONMENT = true;

const DESKTOP_PARTICLES = 80;
const MOBILE_PARTICLES = 20;

/* -------------------------------------------------------------------------- */
/*  Local (asset-free) environment                                            */
/* -------------------------------------------------------------------------- */

/** Procedural studio rig — no external files, used while/if the HDRI is unavailable. */
function LocalEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      {/* Key light, camera-left */}
      <Lightformer
        form="rect"
        intensity={2.4}
        color="#ffffff"
        position={[-4, 2, 4]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[6, 6, 1]}
      />
      {/* Gold rim, camera-right — tints the metal */}
      <Lightformer
        form="rect"
        intensity={2}
        color={GOLD}
        position={[4, -1, 2]}
        rotation={[0, -Math.PI / 4, 0]}
        scale={[5, 5, 1]}
      />
      {/* Cyan kicker from behind for the bloom to catch */}
      <Lightformer
        form="circle"
        intensity={1.6}
        color={CYAN}
        position={[0, 3, -4]}
        scale={3}
      />
      {/* Soft floor bounce */}
      <Lightformer
        form="rect"
        intensity={0.6}
        color="#8a6f1f"
        position={[0, -4, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[8, 8, 1]}
      />
    </Environment>
  );
}

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
      "[HeroScene] HDRI environment unavailable — falling back to the procedural light rig.",
    );
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* -------------------------------------------------------------------------- */
/*  Floating gold form                                                        */
/* -------------------------------------------------------------------------- */

interface GoldShapeProps {
  pointer: RefObject<{ x: number; y: number }>;
  isMobile: boolean;
  reducedMotion: boolean;
}

function GoldShape({ pointer, isMobile, reducedMotion }: GoldShapeProps) {
  const tiltRef = useRef<Group>(null);
  const floatRef = useRef<Group>(null);
  const spinRef = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (reducedMotion) return;

    const elapsed = state.clock.elapsedTime;

    // Idle auto-rotation. Delta-scaled so the speed is frame-rate independent.
    const spin = spinRef.current;
    if (spin) {
      spin.rotation.y += delta * 0.18;
      spin.rotation.x += delta * 0.06;
    }

    // Mouse-follow: the outer group eases toward the normalised cursor offset.
    const tilt = tiltRef.current;
    if (tilt) {
      tilt.rotation.x = MathUtils.lerp(tilt.rotation.x, pointer.current.y * 0.22, 0.045);
      tilt.rotation.y = MathUtils.lerp(tilt.rotation.y, pointer.current.x * 0.32, 0.045);
    }

    // Gentle float.
    const float = floatRef.current;
    if (float) {
      float.position.y = Math.sin(elapsed * 0.55) * 0.12;
    }
  });

  return (
    /* On phones the form floats above the copy; on desktop it sits to the
       right of the headline, filling the empty half of the hero. */
    <group
      ref={tiltRef}
      position={isMobile ? [0, 1.15, 0] : [0.55, 0.05, 0]}
      scale={isMobile ? 0.78 : 1}
    >
      <group ref={floatRef}>
        <mesh ref={spinRef} castShadow={false} receiveShadow={false}>
          {isMobile ? (
            /* Simplified geometry for small screens. */
            <icosahedronGeometry args={[1.25, 1]} />
          ) : (
            <torusKnotGeometry args={[1, 0.32, 220, 32]} />
          )}
          <meshStandardMaterial
            color={GOLD}
            metalness={0.9}
            roughness={0.1}
            envMapIntensity={1.35}
          />
        </mesh>
      </group>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*  Drifting gold particles                                                   */
/* -------------------------------------------------------------------------- */

interface ParticleSeed {
  x: number;
  y: number;
  z: number;
  speed: number;
  phase: number;
  amplitude: number;
  scale: number;
}

/** Deterministic PRNG so the field looks identical on every mount. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSeeds(count: number): ParticleSeed[] {
  const random = mulberry32(0x1a3f9c);

  return Array.from({ length: count }, () => {
    const radius = 2.2 + random() * 2.4;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);

    return {
      x: radius * Math.sin(phi) * Math.cos(theta),
      y: radius * Math.cos(phi) * 0.75,
      z: radius * Math.sin(phi) * Math.sin(theta),
      speed: 0.15 + random() * 0.35,
      phase: random() * Math.PI * 2,
      amplitude: 0.08 + random() * 0.22,
      scale: 0.5 + random() * 1.5,
    };
  });
}

function Particles({
  count,
  reducedMotion,
}: {
  count: number;
  reducedMotion: boolean;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const seeds = useMemo(() => buildSeeds(count), [count]);
  const dummy = useMemo(() => new Object3D(), []);

  // Place every instance once, then only touch rotations/positions per frame.
  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const elapsed = reducedMotion ? 0 : state.clock.elapsedTime;

    for (const [index, seed] of seeds.entries()) {
      dummy.position.set(
        seed.x + Math.sin(elapsed * seed.speed + seed.phase) * seed.amplitude,
        seed.y + Math.cos(elapsed * seed.speed * 0.8 + seed.phase) * seed.amplitude,
        seed.z + Math.sin(elapsed * seed.speed * 0.6 + seed.phase) * seed.amplitude,
      );
      dummy.scale.setScalar(seed.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <sphereGeometry args={[0.022, 6, 6]} />
      <meshBasicMaterial color={GOLD} toneMapped={false} transparent opacity={0.85} />
    </instancedMesh>
  );
}

/* -------------------------------------------------------------------------- */
/*  Lighting rig                                                              */
/* -------------------------------------------------------------------------- */

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 5, 5]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[-5, -2, -4]} intensity={0.6} color={GOLD} />
      <pointLight position={[2.5, -1.5, 2]} intensity={12} distance={9} color={CYAN} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Canvas                                                                    */
/* -------------------------------------------------------------------------- */

interface SceneContentsProps {
  isMobile: boolean;
  reducedMotion: boolean;
  pointer: RefObject<{ x: number; y: number }>;
  /** Bloom pass. Disabled if postprocessing fails to initialise. */
  postProcessing: boolean;
}

/** Everything inside the canvas, with bloom behind a switch so it can be dropped. */
function SceneContents({
  isMobile,
  reducedMotion,
  pointer,
  postProcessing,
}: SceneContentsProps) {
  return (
    <>
      <Lighting />

      <GoldShape
        pointer={pointer}
        isMobile={isMobile}
        reducedMotion={reducedMotion}
      />
      <Particles
        count={isMobile ? MOBILE_PARTICLES : DESKTOP_PARTICLES}
        reducedMotion={reducedMotion}
      />

      {USE_HDRI_ENVIRONMENT ? (
        <EnvironmentErrorBoundary fallback={<LocalEnvironment />}>
          <Suspense fallback={<LocalEnvironment />}>
            <Environment preset="city" resolution={256} />
          </Suspense>
        </EnvironmentErrorBoundary>
      ) : (
        <LocalEnvironment />
      )}

      {postProcessing && (
        <EffectComposer multisampling={isMobile ? 0 : 4}>
          <Bloom
            intensity={isMobile ? 0.5 : 0.9}
            luminanceThreshold={0.18}
            luminanceSmoothing={0.9}
            mipmapBlur
            radius={0.7}
          />
        </EffectComposer>
      )}
    </>
  );
}

/**
 * Catches a postprocessing failure (unsupported extension, context loss) and
 * re-renders the same scene without bloom, so the hero keeps its 3D form.
 */
class PostProcessingBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    console.warn(
      "[HeroScene] Postprocessing unavailable — rendering without bloom.",
    );
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface HeroSceneProps {
  className?: string;
}

/**
 * Immersive gold hero backdrop.
 *
 * Performance notes:
 * - `dpr` is capped at 1.5 and the whole scene pauses (`frameloop="never"`)
 *   whenever the hero scrolls out of view.
 * - Particle matrices are written in place; no per-frame allocations.
 * - Mobile drops to 20 particles and a low-poly icosahedron.
 * - The wrapper is `pointer-events-none`, so the canvas never blocks scrolling
 *   or the hero CTAs. (If drag-to-rotate is ever wanted, mount drei's
 *   `<OrbitControls enableZoom={false} enablePan={false} />` and re-enable
 *   pointer events.)
 */
export function HeroScene({ className }: HeroSceneProps) {
  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  const pointer = useRef({ x: 0, y: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOnScreen, setIsOnScreen] = useState(true);

  // Mouse-follow. A window listener is used because the canvas itself is
  // pointer-events-none, so R3F's own pointer state never updates.
  useEffect(() => {
    if (reducedMotion) return;

    const onPointerMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [reducedMotion]);

  // Stop rendering entirely while the hero is scrolled away.
  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsOnScreen(entry?.isIntersecting ?? true),
      { rootMargin: "100px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className ?? ""}`}
    >
      <Canvas
        dpr={[1, 1.5]}
        frameloop={isOnScreen ? "always" : "never"}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        camera={{ position: [0, 0, 5.2], fov: 45 }}
        /* Rendered if WebGL cannot be created at all — the CSS gradients in
           HeroSection remain, so the hero still reads as designed. */
        fallback={null}
      >
        <Suspense fallback={null}>
          <PostProcessingBoundary
            fallback={
              <SceneContents
                isMobile={isMobile}
                reducedMotion={reducedMotion}
                pointer={pointer}
                postProcessing={false}
              />
            }
          >
            <SceneContents
              isMobile={isMobile}
              reducedMotion={reducedMotion}
              pointer={pointer}
              postProcessing
            />
          </PostProcessingBoundary>
        </Suspense>
      </Canvas>
    </div>
  );
}

export default HeroScene;
