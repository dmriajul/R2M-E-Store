import type { NextAuthConfig } from "next-auth";
import { AUTH_SECRET } from "@/lib/config";
import { normalizeRole, SECTION_ROLES, sectionForPath } from "@/lib/rbac";

/**
 * Edge-safe Auth.js configuration.
 *
 * `middleware.ts` imports this file, so it must never pull in Prisma or bcrypt
 * — the credentials provider is attached in `lib/auth.ts`, which only runs in
 * the Node runtime (route handler + server components). The RBAC matrix in
 * `lib/rbac.ts` is plain data, so it is safe here too.
 */
export const authConfig = {
  secret: AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    /**
     * Route protection.
     *
     * - `/dashboard/*` needs a session.
     * - `/admin/*` needs a console role **and** the right role for the section:
     *   `/admin/coupons` is super-admin only, `/admin/orders` is support, and so
     *   on (see `SECTION_ROLES`). A signed-in shopper is sent to their own area,
     *   a staff member without the section role to `/unauthorized`.
     * - Everything else (storefront, checkout, auth, APIs) stays public; the
     *   API routes and Server Actions do their own role checks.
     */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;

      if (!user) return false; // → redirect to pages.signIn with callbackUrl

      const role = normalizeRole(user.role);

      if (pathname.startsWith("/admin")) {
        if (role === "CUSTOMER") {
          // Signed in but not staff: send them to their own area.
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }

        const section = sectionForPath(pathname);
        if (!SECTION_ROLES[section].includes(role)) {
          const target = new URL("/unauthorized", request.nextUrl);
          target.searchParams.set("from", pathname);
          return Response.redirect(target);
        }
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        /* Legacy `ADMIN` rows normalise to `SUPER_ADMIN` for the whole app. */
        token.role = normalizeRole(user.role);
        token.name = user.name ?? token.name;
        token.phone = user.phone;
        token.emailVerified = Boolean(user.emailVerified);
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : (token.sub ?? "");
        session.user.role = normalizeRole(typeof token.role === "string" ? token.role : null);
        session.user.phone = typeof token.phone === "string" ? token.phone : undefined;
      }
      return { ...session, user: { ...session.user, emailVerified: token.emailVerified === true } };
    },
  },
} satisfies NextAuthConfig;
