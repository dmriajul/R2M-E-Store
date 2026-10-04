"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, LayoutDashboard, LogOut, Package, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { cn, initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const triggerClasses = cn(
  "group relative inline-flex size-9 items-center justify-center rounded-full",
  "text-muted-foreground transition-all duration-300 ease-[var(--ease-luxe)]",
  "hover:bg-glass hover:text-primary hover:shadow-[0_0_24px_-8px_rgba(212,175,55,0.6)]",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:outline-none",
);

const itemClasses =
  "cursor-pointer gap-2 rounded-lg text-xs transition-colors duration-300 focus:bg-glass focus:text-primary";

/**
 * Navbar account entry.
 *
 * Signed out → the person icon on phones and explicit **Login** / **Register**
 * buttons from `md` up. Signed in → the shopper's avatar (plus their first name
 * on wide screens) with a dropdown: Dashboard, Orders, the admin console for
 * ADMINs, and Sign Out.
 *
 * While the session resolves it renders the signed-out control — same size, so
 * the server HTML matches the first client render and nothing shifts.
 */
export function AccountMenu() {
  const { data: session, status } = useSession();
  const user = session?.user;

  if (status === "loading" || !user) {
    return (
      <>
        <Link href="/login" aria-label="Account menu" className={cn(triggerClasses, "md:hidden")}>
          <User className="size-[18px]" />
        </Link>

        <Link
          href="/login"
          className="hidden h-9 items-center rounded-full px-3.5 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase transition-colors duration-300 ease-[var(--ease-luxe)] hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:inline-flex"
        >
          Login
        </Link>

        <Link
          href="/register"
          className="hidden h-9 items-center rounded-full border border-glass-border bg-glass px-3.5 text-xs font-semibold tracking-[0.16em] text-foreground uppercase transition-all duration-300 ease-[var(--ease-luxe)] hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:inline-flex"
        >
          Register
        </Link>
      </>
    );
  }

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    toast.success("Signed out 👋", { description: "See you soon!" });
  };

  const firstName = (user.name ?? user.email ?? "there").split(" ")[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${user.name ?? user.email}`}
          className={cn(
            "group inline-flex h-9 items-center gap-2 rounded-full px-1.5 transition-all duration-300 ease-[var(--ease-luxe)]",
            "text-muted-foreground hover:bg-glass hover:text-primary",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          )}
        >
          <Avatar className="size-7 border border-primary/40">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback className="bg-primary/15 text-[10px] font-bold text-primary">
              {initials(user.name ?? user.email ?? "LL")}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-xs font-semibold md:inline">{firstName}</span>
          <ChevronDown
            aria-hidden
            className="hidden size-3.5 transition-transform duration-300 group-data-[state=open]:rotate-180 md:inline"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-60 border-glass-border bg-[#0F0F0F]/95 backdrop-blur-xl"
      >
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate text-xs font-semibold text-foreground">{user.name}</span>
          <span className="truncate text-[11px] font-normal text-muted-foreground">
            {user.email}
          </span>
          {user.role === "ADMIN" && (
            <span className="mt-0.5 w-fit rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] font-bold tracking-[0.14em] text-primary uppercase">
              Admin
            </span>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-glass-border" />

        <DropdownMenuItem asChild className={itemClasses}>
          <Link href="/dashboard">
            <LayoutDashboard className="size-3.5" />
            Dashboard
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className={itemClasses}>
          <Link href="/dashboard/orders">
            <Package className="size-3.5" />
            Orders
          </Link>
        </DropdownMenuItem>

        {user.role === "ADMIN" && (
          <DropdownMenuItem asChild className={itemClasses}>
            <Link href="/admin">
              <ShieldCheck className="size-3.5" />
              Admin Console
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="bg-glass-border" />

        <DropdownMenuItem
          onSelect={() => {
            void handleSignOut();
          }}
          className={cn(itemClasses, "text-rose focus:text-rose")}
        >
          <LogOut className="size-3.5" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
