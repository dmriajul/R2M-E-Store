"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronRight,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn, initials } from "@/lib/utils";
import { DEMO_WISHLIST_IDS } from "@/lib/mock-dashboard";
import { selectUnreadCount, useDashboardStore } from "@/store/useDashboardStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const EASE_LUXE = [0.22, 1, 0.36, 1] as const;

interface DashboardNavItem {
  href: string;
  label: string;
  emoji: string;
  icon: LucideIcon;
}

/** Sidebar order — Overview first, then the four sub-pages. */
export const DASHBOARD_NAV: readonly DashboardNavItem[] = [
  { href: "/dashboard", label: "Overview", emoji: "📊", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "My Orders", emoji: "📦", icon: Package },
  { href: "/dashboard/wishlist", label: "Wishlist", emoji: "🧸", icon: Heart },
  { href: "/dashboard/addresses", label: "Addresses", emoji: "📍", icon: MapPin },
  { href: "/dashboard/profile", label: "Profile", emoji: "👤", icon: UserRound },
  { href: "/dashboard/notifications", label: "Notifications", emoji: "🔔", icon: Bell },
] as const;

/** Tabs that fit a thumb — the rest live behind "More". */
const MOBILE_TABS: readonly DashboardNavItem[] = [
  DASHBOARD_NAV[0]!,
  DASHBOARD_NAV[1]!,
  DASHBOARD_NAV[2]!,
  DASHBOARD_NAV[4]!,
];

const MOBILE_OVERFLOW: readonly DashboardNavItem[] = [DASHBOARD_NAV[3]!, DASHBOARD_NAV[5]!];

const SEGMENT_LABELS: Readonly<Record<string, string>> = {
  dashboard: "Dashboard",
  orders: "My Orders",
  wishlist: "Wishlist",
  addresses: "Addresses",
  profile: "Profile",
  notifications: "Notifications",
};

const ORDER_ID = /^LL-/i;

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** "Home / Dashboard / My Orders" — the last crumb is the current page. */
function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const label = ORDER_ID.test(segment)
      ? `#${decodeURIComponent(segment)}`
      : (SEGMENT_LABELS[segment] ?? segment.replace(/-/g, " "));

    return { href, label, isLast: index === segments.length - 1 };
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-5 print:hidden">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <li>
          <Link
            href="/"
            className="rounded transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Home
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-1.5">
            <ChevronRight aria-hidden className="size-3 text-muted-foreground/60" />
            {crumb.isLast ? (
              <span aria-current="page" className="font-medium text-foreground">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="rounded transition-colors duration-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Avatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const name = useDashboardStore((state) => state.profile.name);

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary via-rose to-lavender font-bold text-black/80 shadow-[0_6px_20px_-8px_rgba(212,175,55,0.9)]",
        size === "sm" && "size-9 text-xs",
        size === "md" && "size-11 text-sm",
        size === "lg" && "size-20 text-2xl",
      )}
    >
      {initials(name)}
    </span>
  );
}

function NavRow({
  item,
  active,
  unread,
  onNavigate,
}: {
  item: DashboardNavItem;
  active: boolean;
  unread?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300 ease-[var(--ease-luxe)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "bg-primary font-semibold text-primary-foreground shadow-[0_10px_30px_-16px_rgba(212,175,55,0.95)]"
          : "text-muted-foreground hover:bg-white/8 hover:text-foreground",
      )}
    >
      <Icon aria-hidden className="size-[18px] shrink-0" />
      <span className="truncate">{item.label}</span>
      <span aria-hidden className="ml-auto text-sm opacity-80">
        {item.emoji}
      </span>
      {typeof unread === "number" && unread > 0 && (
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
            active ? "bg-black/20 text-primary-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {unread}
        </span>
      )}
    </Link>
  );
}

function LogoutButton({
  className,
  onDone,
}: {
  className?: string;
  onDone?: () => void;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        toast.info("Signed out — see you soon! 👋", {
          description: "You can browse the collection any time.",
        });
        onDone?.();
        router.push("/");
      }}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-all duration-300 ease-[var(--ease-luxe)] hover:bg-rose-soft hover:text-rose focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <LogOut aria-hidden className="size-[18px] shrink-0" />
      Logout
    </button>
  );
}

/**
 * Sidebar identity block: avatar, name, email.
 */
function SidebarIdentity() {
  const profile = useDashboardStore((state) => state.profile);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-glass-border bg-white/4 p-3">
      <Avatar />
      <div className="hidden min-w-0 lg:block">
        <p className="truncate text-sm font-semibold text-foreground">{profile.name}</p>
        <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
      </div>
    </div>
  );
}

/**
 * Account-area chrome: a collapsible sidebar (icon-only on tablet, full on
 * desktop), a bottom tab bar on phones, the breadcrumb trail and the animated
 * content slot.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = usePrefersReducedMotion();
  const unread = useDashboardStore(selectUnreadCount);
  const seeded = useDashboardStore((state) => state.wishlistSeeded);
  const markWishlistSeeded = useDashboardStore((state) => state.markWishlistSeeded);
  const profile = useDashboardStore((state) => state.profile);
  const [moreOpen, setMoreOpen] = useState(false);

  // Demo persona: a signed-in shopper arrives with favourites already saved.
  // Runs in an effect so the server render stays deterministic.
  useEffect(() => {
    if (seeded) return;
    if (useWishlistStore.getState().ids.length === 0) {
      useWishlistStore.setState({ ids: [...DEMO_WISHLIST_IDS] });
    }
    markWishlistSeeded();
  }, [seeded, markWishlistSeeded]);

  const pageAnimation = {
    initial: { opacity: 0, y: reducedMotion ? 0 : 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reducedMotion ? 0 : -10 },
    transition: {
      duration: reducedMotion ? 0.15 : 0.35,
      ease: EASE_LUXE,
    },
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 pt-8 pb-28 sm:px-6 md:pb-14 lg:gap-8 lg:px-8">
      {/* ---------- Sidebar (tablet + desktop) ---------- */}
      <aside className="hidden shrink-0 print:hidden md:flex md:w-[88px] lg:w-72">
        <div className="sticky top-24 flex max-h-[calc(100dvh-8rem)] w-full flex-col gap-4 overflow-y-auto rounded-3xl border border-glass-border bg-[#0C0C0C]/80 p-3 backdrop-blur-xl lg:p-4">
          <Link
            href="/dashboard"
            className="rounded-xl px-1 py-2 text-center text-sm font-bold tracking-[0.3em] text-primary transition-colors duration-300 hover:text-gold-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:text-left"
          >
            LITTLE
            <span className="block lg:inline"> LUXE</span>
          </Link>

          <SidebarIdentity />

          <nav aria-label="Account" className="flex flex-1 flex-col gap-1">
            {DASHBOARD_NAV.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                unread={item.href === "/dashboard/notifications" ? unread : undefined}
              />
            ))}
          </nav>

          <div className="border-t border-glass-border pt-2">
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* ---------- Main column ---------- */}
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={pathname} {...pageAnimation}>
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ---------- Bottom tabs (phones) ---------- */}
      <nav
        aria-label="Account sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-glass-border bg-black/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl print:hidden md:hidden"
      >
        <ul className="flex items-stretch">
          {MOBILE_TABS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="dashboard-tab"
                      className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary"
                    />
                  )}
                </Link>
              </li>
            );
          })}

          <li className="flex-1">
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger
                className="relative flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label="More account sections"
              >
                <Menu aria-hidden className="size-5" />
                More
                {unread > 0 && (
                  <span className="absolute top-2 right-[12%] size-2 rounded-full bg-primary" aria-hidden />
                )}
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[80%] max-w-xs gap-0 border-glass-border bg-[#0C0C0C]/95 backdrop-blur-xl"
              >
                <SheetTitle className="sr-only">Account menu</SheetTitle>
                <div className="flex items-center gap-3 border-b border-glass-border p-4">
                  <Avatar />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{profile.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
                  </div>
                </div>

                <nav aria-label="More" className="flex flex-col gap-1 p-3">
                  {MOBILE_OVERFLOW.map((item) => (
                    <NavRow
                      key={item.href}
                      item={item}
                      active={isActive(pathname, item.href)}
                      unread={item.href === "/dashboard/notifications" ? unread : undefined}
                      onNavigate={() => setMoreOpen(false)}
                    />
                  ))}
                  <Link
                    href="/dashboard"
                    onClick={() => setMoreOpen(false)}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors duration-300 hover:bg-white/8 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <LayoutDashboard aria-hidden className="size-[18px]" />
                    Overview
                  </Link>
                </nav>

                <div className="mt-auto border-t border-glass-border p-3">
                  <LogoutButton onDone={() => setMoreOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </nav>
    </div>
  );
}
