"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { DEMO_WISHLIST_IDS } from "@/lib/mock-dashboard";
import { useDashboardStore, type DashboardSessionUser } from "@/store/useDashboardStore";
import { useWishlistStore } from "@/store/useWishlistStore";

interface DashboardSessionValue {
  /** The signed-in shopper, straight from the Auth.js session. */
  user: DashboardSessionUser & { role: string };
  /**
   * True only for the seeded demo shopper (`sarah@example.com`), whose mock
   * orders, addresses and notifications live in `lib/mock-dashboard.ts`.
   */
  isDemoIdentity: boolean;
}

const DashboardSessionContext = createContext<DashboardSessionValue | null>(null);

/**
 * The account area's single source of identity.
 *
 * `app/(shop)/dashboard/layout.tsx` resolves the Auth.js session on the server
 * and passes the user in here, so every page under `/dashboard` renders the real
 * signed-in person on the first paint — **no component reads a name or email
 * from a store, localStorage or a mock record**.
 *
 * On mount, and whenever the identity changes (sign in as someone else, sign out
 * and back in), the dashboard store is re-pointed at this user: the previous
 * account's addresses, notifications, preferences and seeded wishlist are wiped
 * before the new account's data is loaded.
 */
export function DashboardSessionProvider({
  user,
  isDemoIdentity,
  children,
}: {
  user: DashboardSessionValue["user"];
  isDemoIdentity: boolean;
  children: React.ReactNode;
}) {
  const applyIdentity = useDashboardStore((state) => state.applyIdentity);
  const { id, name, email, phone, role } = user;

  /* Identifies the account, so the sync only runs when it actually changes. */
  const identityKey = `${id}::${email.trim().toLowerCase()}::${isDemoIdentity ? "demo" : "live"}`;
  const previousKey = useRef<string | null>(null);

  useEffect(() => {
    /* A different account than the one the in-memory data belongs to? */
    if (previousKey.current === identityKey) return;
    const previousSeeded = useDashboardStore.getState().wishlistSeeded;
    previousKey.current = identityKey;

    applyIdentity({ id, name, email, phone }, { demo: isDemoIdentity });

    if (isDemoIdentity) {
      /* The demo shopper arrives with a few favourites already saved. */
      if (useWishlistStore.getState().ids.length === 0) {
        useWishlistStore.setState({ ids: [...DEMO_WISHLIST_IDS] });
      }
      useDashboardStore.getState().markWishlistSeeded();
    } else if (previousSeeded) {
      /* Drop the favourites we injected for the previous identity. */
      useWishlistStore.getState().clear();
    }
  }, [identityKey, id, name, email, phone, isDemoIdentity, applyIdentity]);

  const value = useMemo<DashboardSessionValue>(
    () => ({ user: { id, name, email, phone, role }, isDemoIdentity }),
    [id, name, email, phone, role, isDemoIdentity],
  );

  return (
    <DashboardSessionContext.Provider value={value}>{children}</DashboardSessionContext.Provider>
  );
}

/** The signed-in shopper. Throws when used outside `/dashboard`. */
export function useDashboardSession(): DashboardSessionValue {
  const value = useContext(DashboardSessionContext);
  if (!value) {
    throw new Error("useDashboardSession must be used inside the /dashboard layout");
  }
  return value;
}
