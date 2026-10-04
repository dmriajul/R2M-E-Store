"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

/**
 * 200ms fade between storefront routes.
 *
 * Keyed on `pathname`, so every navigation replays the fade while the Navbar and
 * Footer stay mounted above/below it. `AnimatePresence` is deliberately *not*
 * used here: the App Router swaps `children` synchronously, so an exit
 * animation would either never run or hold the old tree on screen. The fade-in
 * is the part users actually perceive.
 *
 * Devices that ask for reduced motion get the content immediately.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}
