import type { NextAuthConfig } from "next-auth";
import { AUTH_SECRET } from "@/lib/config";

/**
 * Edge-safe Auth.js configuration.
 *
 * `middleware.ts` imports this file, so it must never pull in Prisma or bcrypt
 * — the credentials provider is attached in `lib/auth.ts`, which only runs in
 * the Node runtime (route handler + server components).
 */
export const authConfig = {
  secret: AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    /** Route protection: /dashboard needs a session, /admin needs the ADMIN role. */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;

      if (!user) return false; // → redirect to pages.signIn with callbackUrl

      if (pathname.startsWith("/admin") && user.role !== "ADMIN") {
        // Signed in but not staff: send them to their own area.
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "CUSTOMER";
        token.name = user.name ?? token.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : (token.sub ?? "");
        session.user.role = token.role === "ADMIN" ? "ADMIN" : "CUSTOMER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
