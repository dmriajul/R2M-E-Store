/**
 * Admin data-layer errors.
 *
 * Reads and writes in `lib/data/admin-*` must never quietly degrade to mock
 * data, so an expected failure (row gone, unique clash, foreign key, no
 * database) is raised as an `AdminDataError` whose message is safe to show the
 * operator. Anything else is unexpected: it is logged and reported with a
 * generic message so internal details never reach the browser.
 */

/** An expected failure whose `message` may be shown in the console verbatim. */
export class AdminDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminDataError";
  }
}

/** Prisma error codes we can explain without importing the generated client. */
const PRISMA_MESSAGES: Readonly<Record<string, string>> = {
  P2002: "Another record already uses that unique value",
  P2003:
    "This record is referenced by existing orders, so it can't be deleted — unpublish it instead",
  P2025: "That record no longer exists — reload the console",
};

function prismaCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/** Turns any thrown value into a message the console can display. */
export function describeAdminError(error: unknown, fallback: string): string {
  if (error instanceof AdminDataError) return error.message;

  const code = prismaCode(error);
  if (code && PRISMA_MESSAGES[code]) return PRISMA_MESSAGES[code];

  console.error("[admin] Unexpected data-layer failure", error);
  return fallback;
}
