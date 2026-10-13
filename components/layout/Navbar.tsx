"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Menu, Search, ShoppingBag, X, Type, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_LINKS, SITE } from "@/lib/site";
import { useCartStore, selectCartItemCount } from "@/store/useCartStore";
import { useLanguageStore } from "@/store/useLanguageStore";
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
import { AccountMenu } from "@/components/layout/AccountMenu";
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
  /**
   * `revision` advances only on real cart mutations — never on rehydration.
   * The badge bump is keyed off it so restoring a persisted bag on load stays
   * completely still (a pop there would be an animation with no user action
   * behind it).
   */
  const revision = useCartStore((state) => state.revision);
  const [bump, setBump] = useState(0);
  const seenRevision = useRef(revision);

  useEffect(() => {
    if (revision === seenRevision.current) return;
    seenRevision.current = revision;
    setBump((value) => value + 1);
  }, [revision]);
  const reducedMotion = usePrefersReducedMotion();
  const language = useLanguageStore((state) => state.language);
  const toggleLanguage = useLanguageStore((state) => state.toggleLanguage);

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

  const navLinks = language === "bn" ? [
    { label: "হোম", href: "/" },
    { label: "দেখুন", href: "/shop" },
    { label: "সংগ্রহ", href: "/#collections" },
    { label: "পরিচয়", href: "/#about" },
  ] : NAV_LINKS;

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
        aria-label="Main navigation"
        className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-20 lg:px-8"
      >
        {/* ---------- Logo ---------- */}
        <Link
          href="/"
          className="group notranslate shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={`${SITE.name} — home`}
        >
          <Image
            src="/logo.png"
            alt="MUKRA"
            width={180}
            height={50}
            priority
            className="notranslate h-10 w-auto object-contain opacity-95 transition-opacity duration-300 group-hover:opacity-100 md:h-12"
          />
        </Link>

        {/* ---------- Desktop nav ---------- */}
        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
          {navLinks.map((link) => {
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

          {/* Language Toggle */}
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={`Switch language: ${language === "en" ? "বাংলা" : "English"}`}
            title="Switch between English and Bengali"
            className="group relative inline-flex items-center gap-1 rounded-full border border-glass-border bg-glass px-2 py-1 text-xs font-medium transition-all duration-300 hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Type className="size-3 opacity-60" />
            <span className="hidden sm:inline">{language === "en" ? "EN" : "বাং"}</span>
            <span className="sm:hidden">{language === "en" ? "EN" : "বাং"}</span>
          </button>

          <button
            type="button"
            aria-label={`Shopping bag, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
            onClick={() => setIsCartOpen(true)}
            className={cn(
              "group relative inline-flex size-9 items-center justify-center rounded-full",
              "text-muted-foreground transition-all duration-300 ease-[var(--ease-luxe)]",
              "hover:bg-glass hover:text-primary hover:shadow-[0_0_24px_-8px_rgba(212,175,55,0.6)]",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          >
            <ShoppingBag className="size-[18px] transition-transform duration-300 group-hover:scale-110" />
            {/* Keyed on `bump`, which only advances on a user action.
                `bump === 0` is the first appearance — including the mount
                caused by rehydrating the bag — and renders at rest. */}
            {itemCount > 0 && (
              <motion.span
                key={bump}
                initial={bump === 0 || reducedMotion ? { scale: 1 } : { scale: 0.5 }}
                aria-hidden
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

          {/* Bag changes are announced politely (the badge itself is visual). */}
          <span
            id="cart-status"
            role="status"
            aria-live="polite"
            className="sr-only"
          >
            {itemCount === 0
              ? "Shopping bag is empty"
              : `${itemCount} ${itemCount === 1 ? "item" : "items"} in your shopping bag`}
          </span>

          <AccountMenu />

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

              {/* Mobile language toggle */}
              <div className="border-t border-glass-border px-4 py-4">
                <button
                  type="button"
                  onClick={toggleLanguage}
                  aria-label={`Switch language: ${language === "en" ? "বাংলা" : "English"}`}
                  title="Switch between English and Bengali"
                  className="w-full flex items-center justify-between rounded-xl border border-glass-border bg-glass px-4 py-3 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <span className="flex items-center gap-2">
                    <Type className="size-4 opacity-60" />
                    {language === "en" ? "English" : "বাংলা"}
                  </span>
                  <span className="text-muted-foreground">
                    {language === "en" ? "→ বাংলা" : "→ EN"}
                  </span>
                </button>
              </div>
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
