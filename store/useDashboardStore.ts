"use client";

import { create } from "zustand";
import {
  DEMO_SHOPPER,
  EMPTY_DASHBOARD_PROFILE,
  MOCK_ADDRESSES,
  MOCK_NOTIFICATIONS,
} from "@/lib/mock-dashboard";
import type {
  Address,
  DashboardIdentity,
  DashboardPreferenceKey,
  DashboardPreferences,
  DashboardUser,
  NotificationItem,
} from "@/types";

/** The address book is capped, mirroring the real saved-addresses limit. */
export const MAX_ADDRESSES = 3;

/** Defaults for a fresh identity — nothing carries over between accounts. */
const DEFAULT_PREFERENCES: DashboardPreferences = {
  emailNotifications: true,
  smsNotifications: false,
  marketingEmails: true,
  birthdayReminders: true,
};

/** The session fields the account area needs. */
export interface DashboardSessionUser {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface DashboardState {
  /**
   * Whose account the in-memory data belongs to. `null` until the account-area
   * layout applies the session, which is why no component may render `profile`
   * as "the signed-in user" before `identity` is set.
   */
  identity: DashboardIdentity | null;
  /**
   * Editable copy of the signed-in shopper. Identity fields come from the
   * Auth.js session; the extras (birthday, kids, points, spend) are seeded from
   * `DEMO_SHOPPER` for the demo account and left blank for everyone else.
   */
  profile: DashboardUser;
  addresses: Address[];
  notifications: NotificationItem[];
  preferences: DashboardPreferences;
  /**
   * Flipped once the demo wishlist has been loaded into `useWishlistStore`.
   * Kept here so the wishlist page can show a skeleton instead of flashing its
   * empty state on first paint.
   */
  wishlistSeeded: boolean;

  /**
   * Points the store at a session identity.
   *
   * Whatever the previous account left behind is discarded first — addresses,
   * notifications, preferences and the demo wishlist flag — so switching users
   * (admin → shopper, shopper → admin) can never show one account another's
   * data. Demo collections are seeded only when `demo` is true.
   */
  applyIdentity: (user: DashboardSessionUser, options: { demo: boolean }) => void;
  /** Forgets the identity entirely (used on sign-in/sign-out). */
  clearIdentity: () => void;
  updateProfile: (patch: Partial<DashboardUser>) => void;
  markWishlistSeeded: () => void;

  addAddress: (values: Omit<Address, "id">) => void;
  updateAddress: (id: string, values: Omit<Address, "id">) => void;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;

  toggleNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  togglePreference: (key: DashboardPreferenceKey) => void;
}

/** Guarantees exactly one default address, and always at least one. */
function normaliseDefaults(addresses: Address[]): Address[] {
  if (addresses.length === 0) return addresses;

  const defaultCount = addresses.filter((address) => address.isDefault).length;
  if (defaultCount === 1) return addresses;

  return addresses.map((address, index) => ({
    ...address,
    isDefault: defaultCount === 0 ? index === 0 : address.isDefault,
  }));
}

/**
 * Account-area state for the **signed-in shopper only**.
 *
 * Deliberately *not* persisted: nothing here survives a reload, and nothing here
 * is shared between accounts — `applyIdentity()` wipes it whenever the session
 * identity changes. Identity itself is never invented here; it is passed in from
 * the server session by `DashboardSessionProvider`.
 */
export const useDashboardStore = create<DashboardState>()((set) => ({
  identity: null,
  profile: EMPTY_DASHBOARD_PROFILE,
  addresses: [],
  notifications: [],
  preferences: DEFAULT_PREFERENCES,
  wishlistSeeded: false,

  applyIdentity: (user, { demo }) =>
    set({
      identity: { id: user.id, email: user.email.trim().toLowerCase(), demo },
      profile: demo
        ? {
            ...DEMO_SHOPPER,
            // The session wins for identity fields, even for the demo account.
            name: user.name || DEMO_SHOPPER.name,
            email: user.email || DEMO_SHOPPER.email,
            phone: user.phone || DEMO_SHOPPER.phone,
          }
        : {
            ...EMPTY_DASHBOARD_PROFILE,
            name: user.name,
            email: user.email,
            phone: user.phone,
          },
      /* Wipe everything the previous identity left behind. */
      addresses: demo ? [...MOCK_ADDRESSES] : [],
      notifications: demo ? [...MOCK_NOTIFICATIONS] : [],
      preferences: DEFAULT_PREFERENCES,
      wishlistSeeded: false,
    }),

  clearIdentity: () =>
    set({
      identity: null,
      profile: EMPTY_DASHBOARD_PROFILE,
      addresses: [],
      notifications: [],
      preferences: DEFAULT_PREFERENCES,
      wishlistSeeded: false,
    }),

  updateProfile: (patch) =>
    set((state) => ({ profile: { ...state.profile, ...patch } })),

  markWishlistSeeded: () => set({ wishlistSeeded: true }),

  addAddress: (values) =>
    set((state) => {
      const entry: Address = {
        ...values,
        id: `addr-${Date.now().toString(36)}`,
      };

      const withDefaultFlag =
        values.isDefault || state.addresses.length === 0
          ? { ...entry, isDefault: true }
          : entry;

      const existing = withDefaultFlag.isDefault
        ? state.addresses.map((address) => ({ ...address, isDefault: false }))
        : state.addresses;

      return { addresses: [...existing, withDefaultFlag] };
    }),

  updateAddress: (id, values) =>
    set((state) => ({
      addresses: normaliseDefaults(
        state.addresses.map((address) => {
          if (address.id !== id) {
            return values.isDefault ? { ...address, isDefault: false } : address;
          }
          return { ...address, ...values, id };
        }),
      ),
    })),

  removeAddress: (id) =>
    set((state) => ({
      addresses: normaliseDefaults(
        state.addresses.filter((address) => address.id !== id),
      ),
    })),

  setDefaultAddress: (id) =>
    set((state) => ({
      addresses: state.addresses.map((address) => ({
        ...address,
        isDefault: address.id === id,
      })),
    })),

  toggleNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.id === id
          ? { ...notification, read: !notification.read }
          : notification,
      ),
    })),

  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((notification) => ({
        ...notification,
        read: true,
      })),
    })),

  togglePreference: (key) =>
    set((state) => ({
      preferences: { ...state.preferences, [key]: !state.preferences[key] },
    })),
}));

/* Narrow selectors — return primitives so subscribers only re-render on change. */

export const selectUnreadCount = (state: DashboardState): number =>
  state.notifications.filter((notification) => !notification.read).length;

export const selectDefaultAddress = (state: DashboardState): Address | undefined =>
  state.addresses.find((address) => address.isDefault) ?? state.addresses[0];
