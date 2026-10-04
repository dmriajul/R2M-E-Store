"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_LINKS, SITE } from "@/lib/site";
import { Separator } from "@/components/ui/separator";

interface MobileMenuProps {
  /** Called after a link is followed so the parent can close the sheet. */
  onNavigate?: () => void;
}

/**
 * Slide-in navigation for small screens. Rendered inside the Navbar's
 * <Sheet>; keeps its own focus/active styling so it stays a pure view.
 */
export function MobileMenu({ onNavigate }: MobileMenuProps) {
  const pathname = usePathname();

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
                  className={cn(
                    "size-4 transition-all duration-300",
                    "opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>

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
