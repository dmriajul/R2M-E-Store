"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Client-side session context for `useSession()` (navbar, admin shell).
 *
 * No `session` prop is passed on purpose: fetching it on the client keeps every
 * page statically renderable, which is what lets the storefront stay fast and
 * fully prerendered.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>;
}
