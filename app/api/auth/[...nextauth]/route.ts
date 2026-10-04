import { handlers } from "@/lib/auth";

/**
 * Auth.js catch-all route: /api/auth/signin, /api/auth/callback/credentials,
 * /api/auth/session, /api/auth/csrf, /api/auth/signout…
 */
export const { GET, POST } = handlers;

/** bcrypt + Prisma need the Node runtime. */
export const runtime = "nodejs";
