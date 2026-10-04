"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sparkles,
  UserCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatRelative } from "@/lib/utils";
import {
  ADMIN_NAV,
  adminPageMeta,
  isActiveRoute,
  type AdminNavItem,
} from "@/components/admin/admin-nav";
import {
  ADMIN_NOTIFICATIONS,
  ADMIN_USER,
  getStockState,
} from "@/lib/mock-admin";
import { DEMO_NOW } from "@/lib/mock-dashboard";
import { useAdminStore } from "@/store/useAdminStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Gold wordmark block shared by the desktop rail and the mobile drawer. */
function AdminLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/admin"
      aria-label="Little Luxe admin dashboard"
      className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors duration-200 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
    >
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/40 bg-gold-soft text-base"
      >
        👑
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold tracking-[0.18em] text-primary uppercase">
            Little Luxe
          </span>
          <span className="mt-0.5 inline-flex rounded border border-[#2A2A2A] bg-white/5 px-1.5 py-px text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Admin
          </span>
        </span>
      )}
    </Link>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: AdminNavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = isActiveRoute(item.href, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none lg:min-h-9",
        active
          ? "bg-primary font-medium text-primary-foreground"
          : "text-muted-foreground hover:bg-white/6 hover:text-foreground",
        collapsed && "lg:justify-center lg:px-0",
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && active && (
        <ChevronRight aria-hidden className="ml-auto size-3.5 opacity-70" />
      )}
    </Link>
  );
}

function SidebarNav({
  pathname,
  collapsed = false,
  onNavigate,
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Admin sections" className="flex flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-4">
      {ADMIN_NAV.map((section) => (
        <div key={section.label} className="flex flex-col gap-1.5">
          {!collapsed && (
            <p className="px-1.5 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/80 uppercase">
              {section.label}
            </p>
          )}
          {collapsed && <span aria-hidden className="mx-auto h-px w-6 bg-[#242424]" />}
          {section.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

function AdminIdentity({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 border-t border-[#1F1F1F] p-3",
        collapsed && "lg:justify-center lg:px-2",
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/35 bg-gold-soft text-[11px] font-semibold text-primary">
        {ADMIN_USER.initials}
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium text-foreground">
            {ADMIN_USER.name}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {ADMIN_USER.email}
          </span>
        </span>
      )}
      {!collapsed && (
        <span className="ml-auto rounded border border-primary/35 bg-primary/12 px-1.5 py-px text-[10px] font-semibold tracking-[0.1em] text-primary uppercase">
          Admin
        </span>
      )}
    </div>
  );
}

/**
 * Console chrome: collapsible dark-glass rail on desktop, slide-in drawer on
 * phones, and a sticky top bar with global search, alerts and the profile menu.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");

  const setSearch = useAdminStore((state) => state.setSearch);
  const lowStockCount = useAdminStore(
    (state) =>
      state.products.filter(
        (product) =>
          product.trackInventory &&
          getStockState(product.stock, product.lowStockThreshold) === "low-stock",
      ).length,
  );

  const meta = adminPageMeta(pathname);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Client pages can't export metadata, so the console titles itself.
  useEffect(() => {
    document.title = `${meta.title} · Admin · Little Luxe`;
  }, [meta.title]);

  // Keep the shells independent of the storefront scroll behaviour.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    setSearch(term);
      if (term) router.push("/admin/products");
  };

  return (
    <div className="flex min-h-dvh bg-[#0D0D0D] text-foreground">
      {/* ---------- Desktop rail ---------- */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-[#1F1F1F] bg-[#101010] transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <div className={cn("flex items-center gap-2 p-3", collapsed && "justify-center px-2")}>
          <AdminLogo collapsed={collapsed} />
        </div>

        <SidebarNav pathname={pathname} collapsed={collapsed} />

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="mx-2.5 mb-2 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#2A2A2A] text-xs text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden className="size-4" />
          ) : (
            <>
              <PanelLeftClose aria-hidden className="size-4" />
              Collapse
            </>
          )}
        </button>

        <AdminIdentity collapsed={collapsed} />
      </aside>

      {/* ---------- Content column ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[#1F1F1F] bg-[#0D0D0D]/92 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-5">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="inline-flex size-11 items-center justify-center rounded-lg border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none lg:hidden"
            >
              <Menu aria-hidden className="size-4" />
            </button>

            <form role="search" onSubmit={handleSearchSubmit} className="min-w-0 flex-1">
              <label htmlFor="admin-search" className="sr-only">
                Search orders, products
              </label>
              <div className="relative max-w-md">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/80"
                />
                <input
                  id="admin-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search orders, products..."
                  className="h-10 w-full rounded-lg border border-[#2A2A2A] bg-[#151515] pr-3 pl-9 text-sm text-foreground transition-colors duration-200 placeholder:text-muted-foreground/80 focus-visible:border-blue-500/60 focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:outline-none"
                />
              </div>
            </form>

            {/* Alerts */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Notifications${lowStockCount > 0 ? `, ${lowStockCount} low-stock alerts` : ""}`}
                  className="relative inline-flex size-11 items-center justify-center rounded-lg border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none lg:size-10"
                >
                  <Bell aria-hidden className="size-4" />
                  {lowStockCount > 0 && (
                    <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white tabular-nums">
                      {lowStockCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 border-[#2A2A2A] bg-[#141414] p-1.5">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Notifications
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#242424]" />
                {ADMIN_NOTIFICATIONS.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className="flex-col items-start gap-0.5 focus:bg-white/5"
                    onSelect={() => router.push(notification.href)}
                  >
                    <span className="flex w-full items-start gap-2 text-xs font-medium text-foreground">
                      <span aria-hidden>{notification.emoji}</span>
                      <span className="min-w-0">{notification.title}</span>
                      {!notification.read && (
                        <span className="mt-1 ml-auto size-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
                      )}
                    </span>
                    <span className="pl-6 text-[11px] text-muted-foreground">
                      {formatRelative(notification.createdAt, DEMO_NOW)}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Open admin account menu"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] p-1 pr-2.5 transition-colors duration-200 hover:border-[#3A3A3A] hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
                >
                  <span className="grid size-8 place-items-center rounded-full border border-primary/35 bg-gold-soft text-[11px] font-semibold text-primary">
                    {ADMIN_USER.initials}
                  </span>
                  <span className="hidden text-xs font-medium text-foreground sm:block">
                    {ADMIN_USER.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-[#2A2A2A] bg-[#141414] p-1.5">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-foreground">{ADMIN_USER.name}</span>
                  <span className="text-[11px] text-muted-foreground">{ADMIN_USER.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#242424]" />
                <DropdownMenuItem asChild className="text-xs focus:bg-white/5">
                  <Link href="/dashboard/profile">
                    <UserCog aria-hidden /> <span className="text-foreground">Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="text-xs focus:bg-white/5">
                  <Link href="/admin/settings">
                    <Settings aria-hidden /> <span className="text-foreground">Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#242424]" />
                <DropdownMenuItem
                  variant="destructive"
                  className="text-xs"
                  onSelect={() => {
                    toast.success("Signed out of the admin console");
                    router.push("/login");
                  }}
                >
                  <LogOut aria-hidden /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Breadcrumb + page title */}
        <div className="border-b border-[#1F1F1F] bg-[#0D0D0D] px-4 py-4 sm:px-6">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <li>
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1 rounded transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
                >
                  <LayoutDashboard aria-hidden className="size-3" />
                  Admin
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="size-3" />
              </li>
              <li aria-current="page" className="text-foreground">
                {meta.title}
              </li>
            </ol>
          </nav>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {meta.title}
            </h1>
            <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
          </div>
        </div>

        <main id="main-content" className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>

      {/* ---------- Mobile drawer ---------- */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="admin-drawer-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              key="admin-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Admin navigation"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: EASE }}
              className="fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-xs flex-col border-r border-[#242424] bg-[#101010] lg:hidden"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#1F1F1F] p-3">
                <AdminLogo />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation"
                  className="inline-flex size-11 items-center justify-center rounded-lg border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </div>

              <SidebarNav pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
              <AdminIdentity />

              <p className="border-t border-[#1F1F1F] px-4 py-3 text-[11px] text-muted-foreground">
                <Sparkles aria-hidden className="mr-1 inline size-3 text-primary" />
                Demo console — every action is mocked locally.
              </p>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
