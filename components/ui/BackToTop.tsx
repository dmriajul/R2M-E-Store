"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

/**
 * Floating "Back to Top" control.
 *
 * Appears once the visitor has scrolled past 500px, fades/slides in with
 * framer-motion, and smooth-scrolls home. Hidden from screen readers until it
 * is actually visible (`aria-hidden` while off-screen), 48px hit area on
 * mobile and desktop alike.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          initial={{ opacity: 0, y: reducedMotion ? 0 : 16, scale: reducedMotion ? 1 : 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reducedMotion ? 0 : 16, scale: reducedMotion ? 1 : 0.9 }}
          transition={{ duration: reducedMotion ? 0.15 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="fixed right-4 bottom-4 z-40 inline-flex size-12 items-center justify-center rounded-full border border-primary/40 bg-[#101010]/90 text-primary shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md transition-colors duration-300 ease-[var(--ease-luxe)] hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:right-6 sm:bottom-6 print:hidden"
        >
          <ArrowUp aria-hidden className="size-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
