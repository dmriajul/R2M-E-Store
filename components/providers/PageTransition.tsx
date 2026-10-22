"use client";

import { usePathname } from "next/navigation";

/**
 * 200ms fade between storefront routes.
 *
 * Keyed on `pathname`, so every navigation replays the fade while the Navbar
 * and Footer stay mounted above/below it. The fade is a pure CSS animation
 * (`.page-fade` in globals.css) rather than a framer-motion `initial` style:
 * a server-rendered `opacity: 0` would leave the whole page blank whenever
 * hydration is slow or fails, and this wrapper sits above *every* storefront
 * route. CSS paints the fade on first paint with no JavaScript at all, and
 * `prefers-reduced-motion` skips it entirely.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-fade w-full">
      {children}
    </div>
  );
}
