import type { DefaultSession } from "next-auth";
import type { AuthRole } from "@/types";

/**
 * Auth.js module augmentation: the session and JWT carry our user id and role,
 * which is what `middleware.ts` and the admin guard read.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AuthRole;
    } & DefaultSession["user"];
  }

  interface User {
    role?: AuthRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: AuthRole;
  }
}
