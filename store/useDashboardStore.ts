"use client";

import { create } from "zustand";
import { EMPTY_DASHBOARD_PROFILE } from "@/lib/dashboard-constants";
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
   * Auth.js session; the extras (birthday, kids, points, spend) start blank
   * and are edited by the shopper.
   */
  profile: DashboardUser;
  addresses: Address[];
  notifications: NotificationItem[];
  preferences: DashboardPreferences;

  /**
   * Points the store at a session identity.
   *
   * Whatever the previous account left behind is discarded first — addresses,
   * notifications and preferences — so switching users (admin → shopper,
   * shopper → admin) can never show one account another's data.
   */
  applyIdentity: (user: DashboardSessionUser) => void;
  /** Forgets the identity entirely (used on sign-in/sign-out). */
  clearIdentity: () => void;
  updateProfile: (patch: Partial<DashboardUser>) => void;

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

  applyIdentity: (user) =>
    set({
      identity: { id: user.id, email: user.email.trim().toLowerCase() },
      profile: {
        ...EMPTY_DASHBOARD_PROFILE,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      /* Wipe everything the previous identity left behind. */
      addresses: [],
      notifications: [],
      preferences: DEFAULT_PREFERENCES,
    }),

  clearIdentity: () =>
    set({
      identity: null,
      profile: EMPTY_DASHBOARD_PROFILE,
      addresses: [],
      notifications: [],
      preferences: DEFAULT_PREFERENCES,
    }),

  updateProfile: (patch) =>
    set((state) => ({ profile: { ...state.profile, ...patch } })),

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
