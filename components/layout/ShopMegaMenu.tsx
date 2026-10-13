"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import { SHOP_CATEGORIES } from "@/lib/config";
import { cn } from "@/lib/utils";

interface ShopMegaMenuProps {
  label: string;
  active: boolean;
}

/** Desktop shop menu with a contained, predictable keyboard focus loop. */
export function ShopMegaMenu({ label, active }: ShopMegaMenuProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    setIsOpen(false);
  }, [label, pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        rootRef.current?.querySelectorAll<HTMLElement>(
          'button[aria-haspopup="true"], a[role="menuitem"]',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || !rootRef.current?.contains(current))) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (current === last || !rootRef.current?.contains(current))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="shop-mega-menu-root">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "group relative inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium tracking-wide",
          "transition-colors duration-300 ease-[var(--ease-luxe)]",
          "hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          active || isOpen ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 transition-transform duration-200", isOpen && "rotate-180")}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-x-3 -bottom-0.5 h-px origin-center bg-gradient-to-r from-transparent via-primary to-transparent transition-transform duration-300 ease-[var(--ease-luxe)]",
            active || isOpen ? "scale-x-100" : "scale-x-0",
          )}
        />
      </button>

      <motion.div
        id={panelId}
        role="menu"
        aria-label="Shop by category"
        aria-hidden={!isOpen}
        inert={!isOpen}
        initial={false}
        animate={
          isOpen
            ? { opacity: 1, y: 0, visibility: "visible" }
            : { opacity: 0, y: 10, visibility: "hidden" }
        }
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn(
          "absolute inset-x-0 top-full z-[60] border-y border-white/10 bg-[#07110d]/[0.97] shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl",
          !isOpen && "pointer-events-none",
        )}
      >
        <div className="mx-auto max-h-[calc(100dvh-6rem)] w-full max-w-7xl overflow-y-auto px-5 py-6 sm:px-6 lg:px-8">
          <div
            role="none"
            className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4"
          >
            <p className="text-xs text-white/50">
              Made for little moments, built for every day.
            </p>
            <Link
              href="/shop"
              role="menuitem"
              aria-label="Shop all kids fashion"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-2 rounded-sm text-xs font-semibold text-[#C9A961] transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#C9A961] focus-visible:outline-none"
            >
              Shop all pieces
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>

          <div
            role="none"
            className="grid grid-cols-2 gap-x-5 gap-y-8 pb-2 sm:grid-cols-3 lg:grid-cols-6 lg:gap-5"
          >
            {SHOP_CATEGORIES.map((category) => (
              <div key={category.slug} role="none" className="min-w-0">
                <Link
                  href={`/shop?category=${category.slug}`}
                  role="menuitem"
                  aria-label={`Shop ${category.title}`}
                  onClick={() => setIsOpen(false)}
                  className="inline-flex rounded-sm text-sm font-semibold text-white transition-colors hover:text-[#C9A961] focus-visible:ring-2 focus-visible:ring-[#C9A961] focus-visible:outline-none"
                >
                  {("menuTitle" in category ? category.menuTitle : undefined) ?? category.title}
                </Link>
                <ul role="none" className="mt-4 space-y-2.5">
                  {category.subcategories.map((subcategory) => (
                    <li key={subcategory} role="none">
                      <Link
                        href={`/shop?category=${category.slug}`}
                        role="menuitem"
                        aria-label={`Shop ${subcategory} in ${category.title}`}
                        onClick={() => setIsOpen(false)}
                        className="inline-flex rounded-sm text-xs leading-relaxed text-white/60 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#C9A961] focus-visible:outline-none"
                      >
                        {subcategory}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div
              role="none"
              className="col-span-2 flex min-h-44 flex-col justify-between overflow-hidden rounded-2xl border border-[#C9A961]/25 bg-[radial-gradient(100%_120%_at_100%_0%,rgba(201,169,97,0.24),transparent_58%),linear-gradient(135deg,#153523,#08110d)] p-5 sm:col-span-1 lg:min-h-52"
            >
              <div className="flex size-9 items-center justify-center rounded-full border border-[#C9A961]/35 bg-black/20 text-[#C9A961]">
                <Sparkles aria-hidden="true" className="size-4" />
              </div>
              <div className="mt-6">
                <p className="text-[10px] font-semibold tracking-[0.24em] text-[#C9A961] uppercase">
                  Just landed
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">New Arrivals</h2>
                <Link
                  href="/shop?sort=newest"
                  role="menuitem"
                  aria-label="View all new arrivals"
                  onClick={() => setIsOpen(false)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/75 px-4 py-2 text-xs font-semibold text-white transition-all duration-300 hover:bg-white hover:text-black focus-visible:ring-2 focus-visible:ring-[#C9A961] focus-visible:outline-none"
                >
                  View All
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
