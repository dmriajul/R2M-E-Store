"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_LINKS, SITE } from "@/lib/site";
import { SHOP_CATEGORIES } from "@/lib/config";
import { Separator } from "@/components/ui/separator";

interface MobileMenuProps {
  /** Called after a link is followed so the parent can close the sheet. */
  onNavigate?: () => void;
}

/** Slide-in navigation and accessible category accordion for the mobile sheet. */
export function MobileMenu({ onNavigate }: MobileMenuProps) {
  const pathname = usePathname();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-6">
      <ul className="flex flex-col gap-1">
        {NAV_LINKS.map((link, index) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/" && pathname.startsWith(link.href));

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                style={{ animationDelay: `${index * 40}ms` }}
                className={cn(
                  "group flex items-center justify-between rounded-xl px-4 py-3.5",
                  "text-base font-medium tracking-wide transition-all duration-300 ease-[var(--ease-luxe)]",
                  "hover:bg-glass hover:pl-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isActive
                    ? "bg-glass text-primary"
                    : "text-muted-foreground hover:text-primary",
                )}
              >
                <span>{link.label}</span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <Separator className="my-6 bg-glass-border" />

      <section aria-labelledby="mobile-shop-categories-heading">
        <h2
          id="mobile-shop-categories-heading"
          className="px-4 text-[10px] font-semibold tracking-[0.22em] text-[#C9A961] uppercase"
        >
          Shop by category
        </h2>
        <ul className="mt-3 space-y-1">
          {SHOP_CATEGORIES.map((category) => {
            const expanded = expandedCategory === category.slug;
            const subcategoriesId = `mobile-subcategories-${category.slug}`;

            return (
              <li key={category.slug}>
                <div className="flex items-center rounded-xl transition-colors hover:bg-glass">
                  <Link
                    href={`/shop?category=${category.slug}`}
                    onClick={onNavigate}
                    aria-label={`Shop ${category.title}`}
                    className="min-w-0 flex-1 rounded-l-xl px-4 py-3 text-sm font-medium text-white/85 transition-colors hover:text-[#C9A961] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {category.title}
                  </Link>
                  <button
                    type="button"
                    aria-label={`${expanded ? "Hide" : "Show"} ${category.title} subcategories`}
                    aria-expanded={expanded}
                    aria-controls={subcategoriesId}
                    onClick={() =>
                      setExpandedCategory((current) =>
                        current === category.slug ? null : category.slug,
                      )
                    }
                    className="mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:text-[#C9A961] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <ChevronDown
                      aria-hidden="true"
                      className={cn("size-4 transition-transform duration-200", expanded && "rotate-180")}
                    />
                  </button>
                </div>

                <ul
                  id={subcategoriesId}
                  hidden={!expanded}
                  className="ml-5 mt-1 space-y-1 border-l border-white/10 pl-4"
                >
                  {category.subcategories.map((subcategory) => (
                    <li key={subcategory}>
                      <Link
                        href={`/shop?category=${category.slug}`}
                        onClick={onNavigate}
                        aria-label={`Shop ${subcategory} in ${category.title}`}
                        className="block rounded-lg px-3 py-2 text-xs text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {subcategory}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      <Separator className="my-6 bg-glass-border" />

      <div className="flex flex-col gap-4">
        <Link
          href="/login"
          onClick={onNavigate}
          className="rounded-xl border border-glass-border bg-glass px-4 py-3 text-center text-sm font-semibold tracking-[0.18em] text-foreground uppercase transition-all duration-300 ease-[var(--ease-luxe)] hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Sign in
        </Link>
      </div>

      <p className="mt-auto pt-8 text-xs leading-relaxed text-muted-foreground/80">
        {SITE.tagline}
      </p>
    </div>
  );
}
