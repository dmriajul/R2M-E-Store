import type { DefaultSession } from "next-auth";
import type { AuthRole, SessionRole } from "@/types";

/**
 * Auth.js module augmentation: the session and JWT carry our user id and role,
 * which is what `middleware.ts` and the admin guard read.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Already normalised: never the legacy `ADMIN` value. */
      role: SessionRole;
      phone?: string;
      emailVerified?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    emailVerified?: Date | boolean | null;
    role?: AuthRole;
    phone?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    emailVerified?: boolean;
    id?: string;
    role?: SessionRole;
    phone?: string;
  }
}
