"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

/** Palette: gold, pink, cyan, lavender, cream. */
const COLORS = ["#D4AF37", "#F472B6", "#00F0FF", "#A78BFA", "#FFF5E6"] as const;

const PARTICLE_COUNT = 48;

interface Particle {
  id: number;
  x: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  rotate: number;
  rounded: boolean;
}

function buildParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
    id: index,
    x: Math.random() * 100,
    color: COLORS[index % COLORS.length] ?? COLORS[0],
    size: 6 + Math.random() * 8,
    delay: Math.random() * 0.5,
    duration: 2.6 + Math.random() * 1.8,
    drift: (Math.random() - 0.5) * 160,
    rotate: Math.random() * 720 - 360,
    rounded: index % 3 !== 0,
  }));
}

/**
 * Celebration burst for the order-confirmation step: absolutely positioned
 * pieces falling with a slight drift and spin, then fading out. Skipped
 * entirely when the visitor prefers reduced motion.
 */
export function Confetti() {
  const reducedMotion = usePrefersReducedMotion();
  const particles = useMemo(buildParticles, []);

  if (reducedMotion) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
    >
      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className={particle.rounded ? "absolute rounded-full" : "absolute rounded-[2px]"}
          style={{
            left: `${particle.x}%`,
            top: "-6%",
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
          }}
          initial={{ y: 0, opacity: 0, rotate: 0 }}
          animate={{
            y: ["0vh", "70vh"],
            x: [0, particle.drift],
            opacity: [0, 1, 1, 0],
            rotate: particle.rotate,
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            ease: [0.16, 0.7, 0.4, 1],
            times: [0, 0.15, 0.7, 1],
          }}
        />
      ))}
    </div>
  );
}
