"use client";

import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared card for the auth pages: warm glass panel that fades in and rises on
 * mount. Travel distance collapses to 0 when reduced motion is requested.
 */
export function AuthCard({ children, className }: AuthCardProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: reducedMotion ? 0 : 28, scale: reducedMotion ? 1 : 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: reducedMotion ? 0.3 : 0.7,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(
        "glass-soft shadow-playful relative overflow-hidden rounded-3xl border border-glass-border p-6 sm:p-8",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-52 rounded-full bg-primary/10 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 size-52 rounded-full bg-lavender/10 blur-3xl"
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}
