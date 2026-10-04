import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * Route protection.
 *
 * - `/dashboard/*` requires a session (redirects to `/login?callbackUrl=…`).
 * - `/admin/*` requires the ADMIN role (customers bounce to their dashboard).
 * - `/shop`, `/product/*`, `/login`, `/register`, `/checkout` and every API
 *   route stay public.
 *
 * The config imported here is edge-safe: no Prisma, no bcrypt — the JWT is
 * decoded with the shared secret.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
