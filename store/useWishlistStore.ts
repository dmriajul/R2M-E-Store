"use client";

import { create } from "zustand";

interface WishlistState {
  /** Product ids the shopper has hearted. */
  ids: string[];
  toggle: (id: string) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

/**
 * Wishlist hearts. Session-scoped for now — persistence lands with the
 * account/backend step, at which point this store can use zustand's `persist`
 * middleware or hydrate from the user record.
 */
export const useWishlistStore = create<WishlistState>()((set) => ({
  ids: [],

  toggle: (id) =>
    set((state) => ({
      ids: state.ids.includes(id)
        ? state.ids.filter((existing) => existing !== id)
        : [...state.ids, id],
    })),

  add: (id) =>
    set((state) => ({
      ids: state.ids.includes(id) ? state.ids : [...state.ids, id],
    })),

  remove: (id) =>
    set((state) => ({ ids: state.ids.filter((existing) => existing !== id) })),

  clear: () => set({ ids: [] }),
}));

/* Narrow selectors — return primitives so subscribers only re-render on change. */
export const selectIsWishlisted =
  (id: string) =>
  (state: WishlistState): boolean =>
    state.ids.includes(id);

export const selectWishlistCount = (state: WishlistState): number =>
  state.ids.length;
