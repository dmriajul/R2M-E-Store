"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Menu,
  Search,
  ShoppingBag,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_LINKS, SITE } from "@/lib/site";
import { useCartStore, selectCartItemCount } from "@/store/useCartStore";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CartSheet } from "@/components/layout/CartSheet";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { SearchDialog } from "@/components/layout/SearchDialog";

const iconButtonClasses = cn(
  "group relative inline-flex size-9 items-center justify-center rounded-full",
  "text-muted-foreground transition-all duration-300 ease-[var(--ease-luxe)]",
  "hover:bg-glass hover:text-primary hover:shadow-[0_0_24px_-8px_rgba(212,175,55,0.6)]",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:outline-none",
);

interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  /** Renders a link when provided, otherwise a button. */
  href?: string;
  onClick?: () => void;
  className?: string;
}

function IconButton({ icon: Icon, label, href, onClick, className }: IconButtonProps) {
  const content = (
    <Icon className="size-[18px] transition-transform duration-300 group-hover:scale-110" />
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={label}
        className={cn(iconButtonClasses, className)}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(iconButtonClasses, className)}
    >
      {content}
    </button>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const itemCount = useCartStore(selectCartItemCount);
  const reducedMotion = usePrefersReducedMotion();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile sheet whenever navigation occurs.
  useEffect(() => {
    setIsMobileOpen(false);
    setIsCartOpen(false);
    setIsSearchOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-500 ease-[var(--ease-luxe)]",
        "border-b backdrop-blur-xl backdrop-saturate-150",
        isScrolled
          ? "border-glass-border bg-black/70 shadow-[0_10px_40px_-24px_rgba(0,0,0,0.9)]"
          : "border-transparent bg-black/30",
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-20 lg:px-8"
      >
        {/* ---------- Logo ---------- */}
        <Link
          href="/"
          className="group shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={`${SITE.name} — home`}
        >
          <span className="text-gradient-gold text-2xl font-bold tracking-widest transition-opacity duration-300 group-hover:opacity-80 lg:text-[1.75rem]">
            {SITE.name}
          </span>
        </Link>

        {/* ---------- Desktop nav ---------- */}
        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative inline-flex items-center rounded-full px-4 py-2 text-sm font-medium tracking-wide",
                    "transition-colors duration-300 ease-[var(--ease-luxe)]",
                    "hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {link.label}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-3 -bottom-0.5 h-px origin-center bg-gradient-to-r from-transparent via-primary to-transparent transition-transform duration-300 ease-[var(--ease-luxe)]",
                      isActive ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        {/* ---------- Actions ---------- */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <IconButton
            icon={Search}
            label="Search products"
            onClick={() => setIsSearchOpen(true)}
          />

          <button
            type="button"
            aria-label={`Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
            onClick={() => setIsCartOpen(true)}
            className={cn(
              "group relative inline-flex size-9 items-center justify-center rounded-full",
              "text-muted-foreground transition-all duration-300 ease-[var(--ease-luxe)]",
              "hover:bg-glass hover:text-primary hover:shadow-[0_0_24px_-8px_rgba(212,175,55,0.6)]",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          >
            <ShoppingBag className="size-[18px] transition-transform duration-300 group-hover:scale-110" />
            {itemCount > 0 && (
              /* Keyed on the count so every change replays the springy pop. */
              <motion.span
                key={itemCount}
                initial={reducedMotion ? { scale: 1 } : { scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 520, damping: 14, mass: 0.6 }
                }
                className="absolute -top-0.5 -right-0.5"
              >
                <Badge
                  variant="default"
                  className="h-[18px] min-w-[18px] rounded-full border-0 bg-primary px-1 text-[10px] leading-none font-bold text-primary-foreground shadow-[0_0_12px_rgba(212,175,55,0.7)]"
                >
                  {itemCount > 99 ? "99+" : itemCount}
                </Badge>
              </motion.span>
            )}
          </button>

          <IconButton icon={User} label="Account" href="/login" />

          {/* ---------- Mobile hamburger ---------- */}
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <span className="lg:hidden">
                <IconButton icon={Menu} label="Open menu" />
              </span>
            </SheetTrigger>
            <SheetContent
              side="right"
              showCloseButton={false}
              className="w-[86vw] max-w-sm gap-0 border-l border-glass-border bg-black/80 p-0 backdrop-blur-2xl sm:w-96"
            >
              <SheetHeader className="border-b border-glass-border px-6 py-5">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-gradient-gold text-xl font-bold tracking-widest">
                    {SITE.name}
                  </SheetTitle>
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Close menu"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <X className="size-4" />
                    </Button>
                  </SheetClose>
                </div>
              </SheetHeader>

              <MobileMenu onNavigate={() => setIsMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Hairline gold accent under the bar */}
      <span aria-hidden className="hairline-gold block h-px w-full opacity-60" />

      <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
      <CartSheet open={isCartOpen} onOpenChange={setIsCartOpen} />
    </header>
  );
}
