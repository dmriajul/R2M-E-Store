import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * Route protection.
 *
 * - `/dashboard/*` requires a session (redirects to `/login?callbackUrl=…`).
 * - `/checkout` requires a session (redirects to `/login?callbackUrl=%2Fcheckout`).
 * - `/admin/*` requires the ADMIN role (customers bounce to their dashboard).
 * - `/shop`, `/product/*`, `/login`, `/register` and every API route stay
 *   public (protected APIs enforce their own server-side auth).
 *
 * The config imported here is edge-safe: no Prisma, no bcrypt — the JWT is
 * decoded with the shared secret.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/checkout", "/checkout/:path*"],
};
