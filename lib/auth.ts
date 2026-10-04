import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/lib/auth.config";
import { verifyCredentialsDetailed, type CredentialFailure } from "@/lib/data/users";
import { loginSchema } from "@/lib/validations";

/**
 * Auth.js (NextAuth v5) instance.
 *
 * Credentials + bcrypt against Postgres when `DATABASE_URL` exists, and the
 * demo accounts (`admin@littleluxe.com / admin123`, `sarah@example.com /
 * password123`, or any email with `password123`) when it does not — so the
 * login form behaves identically in both modes.
 */
class LoginError extends CredentialsSignin {
  constructor(reason: CredentialFailure) {
    super();
    this.code = reason;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse({
          email: raw?.email,
          password: raw?.password,
          remember: true,
        });
        if (!parsed.success) throw new LoginError("wrong-password");

        const { user, failure } = await verifyCredentialsDetailed(
          parsed.data.email,
          parsed.data.password,
        );
        if (!user) throw new LoginError(failure ?? "wrong-password");

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.avatar ?? null,
        };
      },
    }),
  ],
});

/** Convenience helpers used by API routes and server components. */
export async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function isAdmin(): Promise<boolean> {
  return (await currentUser())?.role === "ADMIN";
}
