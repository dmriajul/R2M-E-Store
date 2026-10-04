"use client";

import { create } from "zustand";
import {
  DEMO_USER,
  MOCK_ADDRESSES,
  MOCK_NOTIFICATIONS,
} from "@/lib/mock-dashboard";
import type {
  Address,
  DashboardPreferenceKey,
  DashboardPreferences,
  DashboardUser,
  NotificationItem,
} from "@/types";

/** The address book is capped, mirroring the real saved-addresses limit. */
export const MAX_ADDRESSES = 3;

interface DashboardState {
  /** Editable copy of the signed-in shopper (see `DEMO_USER`). */
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

export const useDashboardStore = create<DashboardState>()((set) => ({
  profile: DEMO_USER,
  addresses: MOCK_ADDRESSES,
  notifications: MOCK_NOTIFICATIONS,
  preferences: {
    emailNotifications: true,
    smsNotifications: false,
    marketingEmails: true,
    birthdayReminders: true,
  },
  wishlistSeeded: false,

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
