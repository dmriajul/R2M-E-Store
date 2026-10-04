"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds to wait before the reveal starts. */
  delay?: number;
  /** Travel distance in px. Forced to 0 when reduced motion is requested. */
  distance?: number;
  /** When false the element animates every time it enters the viewport. */
  once?: boolean;
}

/**
 * Scroll-reveal wrapper used by the home page to stage each section.
 * Animates opacity + Y once the element is ~20% visible.
 *
 * Reduced motion is handled two ways: the SSR-safe hook zeroes the travel
 * distance, and <MotionConfig reducedMotion="user"> (in the home page) makes
 * framer-motion skip transform animations entirely — so an element can never
 * be left stranded at a non-zero offset.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  distance = 40,
  once = true,
}: RevealProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: reducedMotion ? 0 : distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{
        duration: reducedMotion ? 0.5 : 0.8,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
