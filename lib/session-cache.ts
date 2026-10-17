"use client";

import { useCheckoutStore } from "@/store/useCheckoutStore";
import { signOut } from "next-auth/react";
import { useDashboardStore } from "@/store/useDashboardStore";
import { useWishlistStore } from "@/store/useWishlistStore";

/**
 * Client-side session hygiene.
 *
 * Two levels, on purpose:
 *
 * - `clearIdentityCaches()` drops the in-memory data that belongs to whoever
 *   was signed in a moment ago (account-area profile, addresses, notifications,
 *   seeded wishlist, operator toasts). It runs on every sign-in and sign-out, so
 *   a fresh identity never inherits the previous one's data.
 * - `clearSessionCache()` is the debugging hammer behind the console's
 *   **Clear session & cache** action: it signs out, wipes `localStorage`,
 *   `sessionStorage`, every cookie this origin can see, the Cache Storage API
 *   and any service worker, then reloads at the login screen.
 */

/** Everything that lives in memory and is scoped to the signed-in identity. */
export function clearIdentityCaches(): void {
  useCheckoutStore.getState().reset();
  useDashboardStore.getState().clearIdentity();
  useWishlistStore.getState().clear();
}

/** Cookie names Auth.js uses (v5 + the v4 aliases), for the explicit wipe. */
const SESSION_COOKIE_HINTS = [
  "authjs.session-token",
  "authjs.callback-url",
  "authjs.csrf-token",
  "authjs.pkce.code_verifier",
  "authjs.state",
  "authjs.nonce",
  "__Secure-authjs.session-token",
  "__Host-authjs.csrf-token",
  "next-auth.session-token",
  "next-auth.callback-url",
  "next-auth.csrf-token",
];

/** Expire one cookie on every path/domain variant the browser might hold. */
function expireCookie(name: string): void {
  const paths = ["/", window.location.pathname];
  for (const path of paths) {
    document.cookie = `${name}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    document.cookie = `${name}=; path=${path}; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  }
}

/**
 * Full debug wipe: session, storage, cookies, caches, service workers.
 * Always ends on the login screen with a `?cleared=1` marker.
 */
export async function clearSessionCache(): Promise<void> {
  /* 1. Ask Auth.js to invalidate the session (removes its own cookie). */
  try {
    await signOut({ redirect: false });
  } catch {
    /* Offline or already signed out — the sweep below still runs. */
  }

  /* 2. In-memory identity caches. */
  clearIdentityCaches();

  /* 3. Web storage. */
  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    /* Safari private mode throws — nothing to clear in that case. */
  }

  /* 4. Cookies: the known session cookies plus anything readable on this origin. */
  for (const name of SESSION_COOKIE_HINTS) expireCookie(name);
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) expireCookie(name);
  }

  /* 5. Cache Storage + service workers, so a stale shell can't come back. */
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* Not supported — ignore. */
  }
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    /* Not supported — ignore. */
  }

  /* 6. Hard reload at the login screen so no stale client bundle lingers. */
  window.location.replace("/login?cleared=1");
}
