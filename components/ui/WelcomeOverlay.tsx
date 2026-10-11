"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

const SESSION_KEY = "mukra-welcome-intro-shown";

export function WelcomeOverlay() {
  const reducedMotion = usePrefersReducedMotion();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setIsVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(
      () => setIsVisible(false),
      reducedMotion ? 0 : 1200,
    );
    return () => clearTimeout(timer);
  }, [isVisible, reducedMotion]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          role="status"
          aria-label="Welcome to MUKRA"
          aria-live="polite"
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#090A10]"
          exit={{ opacity: 0 }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reducedMotion ? 0.15 : 0.45, ease: "easeOut" }}
        >
          <motion.div
            className="px-6 text-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reducedMotion ? 0.15 : 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-[10px] tracking-[0.38em] text-[#D4AF37]/75 uppercase sm:text-xs">
              A world of little wonders
            </p>
            <h1 className="mt-4 text-3xl font-light tracking-wide text-white sm:text-5xl">
              Welcome to <span className="text-[#D4AF37]">MUKRA</span>
            </h1>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
